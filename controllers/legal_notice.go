package controllers

import (
	"context"
	"fmt"
	"html"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"unified-id/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type legalMetaRecord struct {
	Key       string    `bson:"key"`
	Value     string    `bson:"value"`
	UpdatedAt time.Time `bson:"updated_at"`
}

type legalNoticeEvent struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	Version   string             `bson:"version"`
	UserID    string             `bson:"user_id"`
	Email     string             `bson:"email"`
	Status    string             `bson:"status"` // pending|sent|failed
	Error     string             `bson:"error,omitempty"`
	SentAt    *time.Time         `bson:"sent_at,omitempty"`
	CreatedAt time.Time          `bson:"created_at"`
	UpdatedAt time.Time          `bson:"updated_at"`
}

// NotifyLegalDocsUpdateIfNeeded sends legal update emails to active users in batches.
// Delivery is deduplicated by (version, user_id), so repeated starts won't resend.
// Configure with:
// - LEGAL_DOCS_VERSION (e.g. "2026-05-21")
// - LEGAL_NOTIFY_BATCH_SIZE (optional, default 200)
// - LEGAL_NOTIFY_ACTIVE_WINDOW_DAYS (optional, default 3650)
func NotifyLegalDocsUpdateIfNeeded() error {
	version := strings.TrimSpace(os.Getenv("LEGAL_DOCS_VERSION"))
	if version == "" {
		return nil
	}

	col := models.GetCollection(models.LegalMetaCollection)
	eventsCol := models.GetCollection(models.LegalNoticeEventsCollection)
	usersCol := models.NewUserCRUD().Collection()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var current legalMetaRecord
	_ = col.FindOne(ctx, bson.M{"key": "legal_docs_version"}).Decode(&current)

	base := strings.TrimRight(getBaseURL(), "/")
	termsURL := base + "/terms"
	privacyURL := base + "/privacy"
	subject := fmt.Sprintf("Neo ID legal documents updated (%s)", version)

	batchSize := getenvInt("LEGAL_NOTIFY_BATCH_SIZE", 200)
	if batchSize < 10 {
		batchSize = 10
	}
	activeWindowDays := getenvInt("LEGAL_NOTIFY_ACTIVE_WINDOW_DAYS", 3650)
	if activeWindowDays < 1 {
		activeWindowDays = 3650
	}

	activeAfter := time.Now().AddDate(0, 0, -activeWindowDays)
	var lastID primitive.ObjectID
	sentCount := 0
	failCount := 0
	skippedCount := 0

	for {
		filter := bson.M{
			"email":          bson.M{"$exists": true, "$ne": ""},
			"email_verified": true,
			"is_banned":      bson.M{"$ne": true},
			"$or": []bson.M{
				{"last_login": bson.M{"$gte": activeAfter}},
				{"created_at": bson.M{"$gte": activeAfter}},
			},
		}
		if !lastID.IsZero() {
			filter["_id"] = bson.M{"$gt": lastID}
		}

		cursor, findErr := usersCol.Find(
			context.Background(),
			filter,
			options.Find().
				SetProjection(bson.M{"unified_id": 1, "email": 1, "_id": 1}).
				SetSort(bson.D{{Key: "_id", Value: 1}}).
				SetLimit(int64(batchSize)),
		)
		if findErr != nil {
			return findErr
		}

		batchHasRows := false
		for cursor.Next(context.Background()) {
			batchHasRows = true
			var user struct {
				ID        primitive.ObjectID `bson:"_id"`
				UnifiedID string             `bson:"unified_id"`
				Email     string             `bson:"email"`
			}
			if decodeErr := cursor.Decode(&user); decodeErr != nil {
				failCount++
				continue
			}
			lastID = user.ID
			email := strings.TrimSpace(strings.ToLower(user.Email))
			if email == "" || user.UnifiedID == "" {
				skippedCount++
				continue
			}

			now := time.Now()
			insert := legalNoticeEvent{
				Version:   version,
				UserID:    user.UnifiedID,
				Email:     email,
				Status:    "pending",
				CreatedAt: now,
				UpdatedAt: now,
			}
			_, insErr := eventsCol.InsertOne(context.Background(), insert)
			if insErr != nil {
				if mongo.IsDuplicateKeyError(insErr) {
					skippedCount++
					continue
				}
				failCount++
				continue
			}

			body := buildLegalDocsUpdatedHTML(version, termsURL, privacyURL)
			sendErr := sendResendEmail(email, subject, body)
			if sendErr != nil {
				failCount++
				_, _ = eventsCol.UpdateOne(
					context.Background(),
					bson.M{"version": version, "user_id": user.UnifiedID},
					bson.M{"$set": bson.M{"status": "failed", "error": truncate(sendErr.Error(), 1000), "updated_at": time.Now()}},
				)
				continue
			}
			sentAt := time.Now()
			sentCount++
			_, _ = eventsCol.UpdateOne(
				context.Background(),
				bson.M{"version": version, "user_id": user.UnifiedID},
				bson.M{"$set": bson.M{"status": "sent", "error": "", "sent_at": sentAt, "updated_at": sentAt}},
			)
		}
		_ = cursor.Close(context.Background())
		if !batchHasRows {
			break
		}
	}

	log.Printf("legal notice dispatch finished: version=%s sent=%d failed=%d skipped=%d", version, sentCount, failCount, skippedCount)

	_, upsertErr := col.UpdateOne(
		ctx,
		bson.M{"key": "legal_docs_version"},
		bson.M{
			"$set": bson.M{
				"value":      version,
				"updated_at": time.Now(),
			},
		},
		options.Update().SetUpsert(true),
	)
	return upsertErr
}

func getenvInt(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return v
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max]
}

func buildLegalDocsUpdatedHTML(version, termsURL, privacyURL string) string {
	v := html.EscapeString(version)
	t := html.EscapeString(termsURL)
	p := html.EscapeString(privacyURL)
	return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:36px 28px;" cellpadding="0" cellspacing="0">
      <tr><td>
        <div style="font-size:18px;font-weight:700;color:#111111;margin-bottom:16px;">Neo ID</div>
        <div style="font-size:22px;font-weight:700;color:#111111;margin-bottom:8px;">Legal documents updated</div>
        <div style="font-size:14px;color:#666666;line-height:1.6;margin-bottom:20px;">
          Terms of Service and/or Privacy Policy were updated.<br/>
          Version: <strong>` + v + `</strong>
        </div>
        <div style="font-size:14px;line-height:1.8;">
          <a href="` + t + `" style="color:#111111;">Open Terms of Service</a><br/>
          <a href="` + p + `" style="color:#111111;">Open Privacy Policy</a>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}
