package models

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type ServiceApp struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name        string             `bson:"name" json:"name"`
	OwnerUserID string             `bson:"owner_user_id" json:"owner_user_id"`

	TokenPrefix string `bson:"token_prefix" json:"token_prefix"`
	TokenHash   string `bson:"token_hash" json:"-"`

	CreatedAt time.Time  `bson:"created_at" json:"created_at"`
	RevokedAt *time.Time `bson:"revoked_at,omitempty" json:"revoked_at,omitempty"`
}

type ServiceAppCRUD struct {
	collection *mongo.Collection
}

func NewServiceAppCRUD() *ServiceAppCRUD {
	return &ServiceAppCRUD{collection: GetCollection(ServiceAppsCollection)}
}

func generateServiceToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "sid_" + hex.EncodeToString(b), nil
}

func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func tokenPrefix(token string) string {
	if len(token) <= 10 {
		return token
	}
	return token[:10]
}

func (sc *ServiceAppCRUD) CreateServiceApp(name, ownerUserID string) (*ServiceApp, string, error) {
	plain, err := generateServiceToken()
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate token: %w", err)
	}

	app := &ServiceApp{
		Name:        name,
		OwnerUserID: ownerUserID,
		TokenPrefix: tokenPrefix(plain),
		TokenHash:   tokenHash(plain),
		CreatedAt:   time.Now(),
	}

	ctx := context.Background()
	res, err := sc.collection.InsertOne(ctx, app)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create service app: %w", err)
	}
	app.ID = res.InsertedID.(primitive.ObjectID)
	return app, plain, nil
}

func (sc *ServiceAppCRUD) ListByOwner(ownerUserID string) ([]ServiceApp, error) {
	ctx := context.Background()
	cur, err := sc.collection.Find(ctx, bson.M{"owner_user_id": ownerUserID})
	if err != nil {
		return nil, fmt.Errorf("failed to list service apps: %w", err)
	}
	defer cur.Close(ctx)

	var out []ServiceApp
	if err := cur.All(ctx, &out); err != nil {
		return nil, fmt.Errorf("failed to decode service apps: %w", err)
	}
	return out, nil
}

func (sc *ServiceAppCRUD) RevokeByID(ownerUserID, id string) error {
	ctx := context.Background()
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid id")
	}
	now := time.Now()
	_, err = sc.collection.UpdateOne(ctx, bson.M{"_id": objID, "owner_user_id": ownerUserID}, bson.M{"$set": bson.M{"revoked_at": &now}})
	if err != nil {
		return fmt.Errorf("failed to revoke: %w", err)
	}
	return nil
}

func (sc *ServiceAppCRUD) DeleteByID(ownerUserID, id string) error {
	ctx := context.Background()
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return fmt.Errorf("invalid id")
	}
	_, err = sc.collection.DeleteOne(ctx, bson.M{"_id": objID, "owner_user_id": ownerUserID})
	if err != nil {
		return fmt.Errorf("failed to delete: %w", err)
	}
	return nil
}

func (sc *ServiceAppCRUD) VerifyToken(token string) (*ServiceApp, error) {
	ctx := context.Background()
	var app ServiceApp
	err := sc.collection.FindOne(ctx, bson.M{"token_hash": tokenHash(token), "revoked_at": bson.M{"$exists": false}}).Decode(&app)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to verify service token: %w", err)
	}
	return &app, nil
}
