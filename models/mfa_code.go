package models

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// MFACode stores a pending login verification code
type MFACode struct {
	ID        primitive.ObjectID `bson:"_id,omitempty"`
	UserID    string             `bson:"user_id"`
	Email     string             `bson:"email"`
	Code      string             `bson:"code"`
	ExpiresAt time.Time          `bson:"expires_at"`
	Used      bool               `bson:"used"`
	CreatedAt time.Time          `bson:"created_at"`
	// Optional: carry OIDC / site context through the MFA step
	SiteID      string `bson:"site_id,omitempty"`
	RedirectURL string `bson:"redirect_url,omitempty"`
	SiteState   string `bson:"site_state,omitempty"`
}

type MFACodeCRUD struct {
	collection *mongo.Collection
}

func NewMFACodeCRUD() *MFACodeCRUD {
	return &MFACodeCRUD{collection: GetCollection(MFACodesCollection)}
}

func (m *MFACodeCRUD) Create(code *MFACode) error {
	ctx := context.Background()
	code.CreatedAt = time.Now()
	result, err := m.collection.InsertOne(ctx, code)
	if err != nil {
		return fmt.Errorf("failed to create mfa code: %w", err)
	}
	code.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetByEmail returns the latest unused, non-expired code for an email
func (m *MFACodeCRUD) GetByEmail(email string) (*MFACode, error) {
	ctx := context.Background()
	var code MFACode
	err := m.collection.FindOne(ctx, bson.M{
		"email":      email,
		"used":       false,
		"expires_at": bson.M{"$gt": time.Now()},
	}).Decode(&code)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get mfa code: %w", err)
	}
	return &code, nil
}

func (m *MFACodeCRUD) MarkUsed(id primitive.ObjectID) error {
	ctx := context.Background()
	_, err := m.collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"used": true}})
	return err
}

// DeleteByEmail removes all codes for an email (cleanup before creating new one)
func (m *MFACodeCRUD) DeleteByEmail(email string) error {
	ctx := context.Background()
	_, err := m.collection.DeleteMany(ctx, bson.M{"email": email})
	return err
}
