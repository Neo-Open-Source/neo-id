package models

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// AuthCode represents an OIDC authorization code
type AuthCode struct {
	ID                  primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Code                string             `bson:"code" json:"code"`
	ClientID            string             `bson:"client_id" json:"client_id"`
	UserID              string             `bson:"user_id" json:"user_id"`
	RedirectURI         string             `bson:"redirect_uri" json:"redirect_uri"`
	Scope               string             `bson:"scope" json:"scope"`
	Nonce               string             `bson:"nonce,omitempty" json:"nonce,omitempty"`
	CodeChallenge       string             `bson:"code_challenge,omitempty" json:"code_challenge,omitempty"`
	CodeChallengeMethod string             `bson:"code_challenge_method,omitempty" json:"code_challenge_method,omitempty"`
	Used                bool               `bson:"used" json:"used"`
	ExpiresAt           time.Time          `bson:"expires_at" json:"expires_at"`
	CreatedAt           time.Time          `bson:"created_at" json:"created_at"`
}

type AuthCodeCRUD struct {
	collection *mongo.Collection
}

func NewAuthCodeCRUD() *AuthCodeCRUD {
	return &AuthCodeCRUD{collection: GetCollection(AuthCodesCollection)}
}

func (a *AuthCodeCRUD) Create(code *AuthCode) error {
	ctx := context.Background()
	code.CreatedAt = time.Now()
	result, err := a.collection.InsertOne(ctx, code)
	if err != nil {
		return fmt.Errorf("failed to create auth code: %w", err)
	}
	code.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (a *AuthCodeCRUD) GetByCode(code string) (*AuthCode, error) {
	ctx := context.Background()
	var ac AuthCode
	err := a.collection.FindOne(ctx, bson.M{"code": code, "used": false}).Decode(&ac)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get auth code: %w", err)
	}
	return &ac, nil
}

func (a *AuthCodeCRUD) MarkUsed(id primitive.ObjectID) error {
	ctx := context.Background()
	_, err := a.collection.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"used": true}})
	return err
}
