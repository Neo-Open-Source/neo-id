package models

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// SessionCRUD operations
type SessionCRUD struct {
	collection *mongo.Collection
}

func activeSessionFilter(userID string) bson.M {
	now := time.Now()
	return bson.M{
		"user_id": userID,
		"$or": []bson.M{
			{"refresh_expires_at": bson.M{"$gt": now}},
			{"refresh_expires_at": bson.M{"$exists": false}, "expires_at": bson.M{"$gt": now}},
		},
	}
}

func NewSessionCRUD() *SessionCRUD {
	return &SessionCRUD{
		collection: GetCollection(SessionsCollection),
	}
}

// CreateSession creates a new session
func (sc *SessionCRUD) CreateSession(session *Session) error {
	ctx := context.Background()
	session.CreatedAt = time.Now()

	result, err := sc.collection.InsertOne(ctx, session)
	if err != nil {
		return fmt.Errorf("failed to create session: %w", err)
	}

	session.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetSessionByToken gets session by token
func (sc *SessionCRUD) GetSessionByToken(token string) (*Session, error) {
	ctx := context.Background()
	var session Session

	err := sc.collection.FindOne(ctx, bson.M{
		"token":      token,
		"expires_at": bson.M{"$gt": time.Now()},
	}).Decode(&session)

	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	return &session, nil
}

// SetGeo updates country and city for a session
func (sc *SessionCRUD) SetGeo(token, country, city string) error {
	ctx := context.Background()
	_, err := sc.collection.UpdateOne(ctx,
		bson.M{"token": token},
		bson.M{"$set": bson.M{"country": country, "city": city}},
	)
	return err
}

// UpdateAllSessionsDuration updates refresh_expires_at for all active sessions of a user
// based on new duration. Each session gets: created_at + N months.
func (sc *SessionCRUD) UpdateAllSessionsDuration(userID string, months int) error {
	ctx := context.Background()
	sessions, err := sc.GetUserSessions(userID)
	if err != nil {
		return err
	}
	for _, s := range sessions {
		newExp := s.CreatedAt.AddDate(0, months, 0)
		_, _ = sc.collection.UpdateOne(ctx,
			bson.M{"_id": s.ID},
			bson.M{"$set": bson.M{
				"refresh_expires_at":      newExp,
				"refresh_duration_months": months,
			}},
		)
	}
	return nil
}

// GetSessionByRefreshToken gets session by refresh token
func (sc *SessionCRUD) GetSessionByRefreshToken(refreshToken string) (*Session, error) {
	ctx := context.Background()
	var session Session
	err := sc.collection.FindOne(ctx, bson.M{
		"refresh_token":      refreshToken,
		"refresh_expires_at": bson.M{"$gt": time.Now()},
	}).Decode(&session)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get session by refresh token: %w", err)
	}
	return &session, nil
}

// GetUserSessions returns all active sessions for a user
func (sc *SessionCRUD) GetUserSessions(userID string) ([]Session, error) {
	ctx := context.Background()
	cursor, err := sc.collection.Find(ctx, activeSessionFilter(userID))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var sessions []Session
	_ = cursor.All(ctx, &sessions)
	return sessions, nil
}

// UpdateSessionTokens replaces access token and updates last_used_at
func (sc *SessionCRUD) UpdateSessionTokens(oldToken, newToken string, newExpiry time.Time) error {
	ctx := context.Background()
	_, err := sc.collection.UpdateOne(ctx,
		bson.M{"token": oldToken},
		bson.M{"$set": bson.M{
			"token":        newToken,
			"expires_at":   newExpiry,
			"last_used_at": time.Now(),
		}},
	)
	return err
}

// TouchSession updates last_used_at and optionally rolls refresh token
func (sc *SessionCRUD) TouchSession(token string) error {
	ctx := context.Background()
	_, err := sc.collection.UpdateOne(ctx,
		bson.M{"token": token},
		bson.M{"$set": bson.M{"last_used_at": time.Now()}},
	)
	return err
}

// RotateSessionByRefreshToken atomically rotates access/refresh tokens in the same session row.
func (sc *SessionCRUD) RotateSessionByRefreshToken(oldRefreshToken, newAccessToken, newRefreshToken string, accessExp, refreshExp time.Time, ipAddress, userAgent string) error {
	ctx := context.Background()
	update := bson.M{
		"token":              newAccessToken,
		"expires_at":         accessExp,
		"refresh_token":      newRefreshToken,
		"refresh_expires_at": refreshExp,
		"last_used_at":       time.Now(),
	}
	if ipAddress != "" {
		update["ip_address"] = ipAddress
	}
	if userAgent != "" {
		update["user_agent"] = userAgent
	}

	res, err := sc.collection.UpdateOne(
		ctx,
		bson.M{
			"refresh_token":      oldRefreshToken,
			"refresh_expires_at": bson.M{"$gt": time.Now()},
		},
		bson.M{"$set": update},
	)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return mongo.ErrNoDocuments
	}
	return nil
}

// RevokeSession deletes a specific session by ID (for session management UI)
func (sc *SessionCRUD) RevokeSessionByID(id primitive.ObjectID, userID string) error {
	ctx := context.Background()
	_, err := sc.collection.DeleteOne(ctx, bson.M{"_id": id, "user_id": userID})
	return err
}

// DeleteSession deletes a session
func (sc *SessionCRUD) DeleteSession(token string) error {
	ctx := context.Background()

	_, err := sc.collection.DeleteOne(ctx, bson.M{"token": token})
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	return nil
}

// DeleteUserSessions deletes all sessions for a user
func (sc *SessionCRUD) DeleteUserSessions(userID string) error {
	ctx := context.Background()

	_, err := sc.collection.DeleteMany(ctx, bson.M{"user_id": userID})
	if err != nil {
		return fmt.Errorf("failed to delete user sessions: %w", err)
	}

	return nil
}

// CountUserSessions counts active (non-expired) sessions for a user
func (sc *SessionCRUD) CountUserSessions(userID string) (int, error) {
	ctx := context.Background()
	count, err := sc.collection.CountDocuments(ctx, activeSessionFilter(userID))
	if err != nil {
		return 0, fmt.Errorf("failed to count user sessions: %w", err)
	}
	return int(count), nil
}

// DeleteOldestSession deletes the active session with the oldest last_used_at for a user
func (sc *SessionCRUD) DeleteOldestSession(userID string) error {
	ctx := context.Background()
	var oldest Session
	opts := options.FindOne().SetSort(bson.D{{Key: "last_used_at", Value: 1}})
	err := sc.collection.FindOne(ctx, activeSessionFilter(userID), opts).Decode(&oldest)
	if err == mongo.ErrNoDocuments {
		return nil
	}
	if err != nil {
		return fmt.Errorf("failed to find oldest session: %w", err)
	}
	_, err = sc.collection.DeleteOne(ctx, bson.M{"_id": oldest.ID})
	if err != nil {
		return fmt.Errorf("failed to delete oldest session: %w", err)
	}
	return nil
}

// DeleteUserSessionsExcept deletes all sessions for a user except the one with the given token
func (sc *SessionCRUD) DeleteUserSessionsExcept(userID, exceptToken string) error {
	ctx := context.Background()
	_, err := sc.collection.DeleteMany(ctx, bson.M{
		"user_id": userID,
		"token":   bson.M{"$ne": exceptToken},
	})
	if err != nil {
		return fmt.Errorf("failed to delete user sessions: %w", err)
	}
	return nil
}

// CleanupExpiredSessions removes expired sessions
func (sc *SessionCRUD) CleanupExpiredSessions() error {
	ctx := context.Background()

	_, err := sc.collection.DeleteMany(ctx, bson.M{
		"expires_at": bson.M{"$lt": time.Now()},
		"$or": []bson.M{
			// Legacy sessions without refresh lifecycle metadata
			{"refresh_expires_at": bson.M{"$exists": false}},
			// Refresh token has also expired
			{"refresh_expires_at": bson.M{"$lt": time.Now()}},
		},
	})

	if err != nil {
		return fmt.Errorf("failed to cleanup expired sessions: %w", err)
	}

	return nil
}

// ServiceCRUD operations
type ServiceCRUD struct {
	collection *mongo.Collection
}

func NewServiceCRUD() *ServiceCRUD {
	return &ServiceCRUD{
		collection: GetCollection(ServicesCollection),
	}
}

// CreateService creates a new service
func (sc *ServiceCRUD) CreateService(service *Service) error {
	ctx := context.Background()
	service.CreatedAt = time.Now()

	result, err := sc.collection.InsertOne(ctx, service)
	if err != nil {
		return fmt.Errorf("failed to create service: %w", err)
	}

	service.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetServiceByName gets service by name
func (sc *ServiceCRUD) GetServiceByName(name string) (*Service, error) {
	ctx := context.Background()
	var service Service

	err := sc.collection.FindOne(ctx, bson.M{"name": name}).Decode(&service)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get service: %w", err)
	}

	return &service, nil
}

// GetAllActiveServices gets all active services
func (sc *ServiceCRUD) GetAllActiveServices() ([]Service, error) {
	ctx := context.Background()

	cursor, err := sc.collection.Find(ctx, bson.M{"is_active": true})
	if err != nil {
		return nil, fmt.Errorf("failed to get services: %w", err)
	}
	defer cursor.Close(ctx)

	var services []Service
	if err := cursor.All(ctx, &services); err != nil {
		return nil, fmt.Errorf("failed to decode services: %w", err)
	}

	return services, nil
}
