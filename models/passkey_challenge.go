package models

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type PasskeyChallenge struct {
	UserID      string    `bson:"user_id"`
	Challenge   string    `bson:"challenge"`
	Type        string    `bson:"type"`
	MFAVerified bool      `bson:"mfa_verified"`
	ExpiresAt   time.Time `bson:"expires_at"`
	CreatedAt   time.Time `bson:"created_at"`
}

type PasskeyChallengeCRUD struct {
	collection *mongo.Collection
}

func NewPasskeyChallengeCRUD() *PasskeyChallengeCRUD {
	return &PasskeyChallengeCRUD{collection: GetCollection(PasskeyChallengesCollection)}
}

func (pc *PasskeyChallengeCRUD) Create(challenge *PasskeyChallenge) error {
	ctx := context.Background()
	_, err := pc.collection.InsertOne(ctx, challenge)
	if err != nil {
		return fmt.Errorf("failed to create passkey challenge: %w", err)
	}
	return nil
}

func (pc *PasskeyChallengeCRUD) GetByUserID(userID string) (*PasskeyChallenge, error) {
	ctx := context.Background()
	var out PasskeyChallenge
	err := pc.collection.FindOne(ctx, bson.M{"user_id": userID}).Decode(&out)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get passkey challenge: %w", err)
	}
	return &out, nil
}

func (pc *PasskeyChallengeCRUD) DeleteByUserID(userID string) error {
	ctx := context.Background()
	_, err := pc.collection.DeleteMany(ctx, bson.M{"user_id": userID})
	if err != nil {
		return fmt.Errorf("failed to delete passkey challenge: %w", err)
	}
	return nil
}
