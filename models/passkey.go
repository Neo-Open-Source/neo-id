package models

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Passkey struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID       string             `bson:"user_id" json:"user_id"`
	Name         string             `bson:"name" json:"name"`
	CredentialID string             `bson:"credential_id" json:"credential_id"`
	PublicKey    string             `bson:"public_key,omitempty" json:"-"`
	Transports   []string           `bson:"transports,omitempty" json:"transports,omitempty"`
	DeviceType   string             `bson:"device_type,omitempty" json:"device_type,omitempty"`
	LastUsedAt   *time.Time         `bson:"last_used_at,omitempty" json:"last_used_at,omitempty"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
}

type PasskeyCRUD struct {
	collection *mongo.Collection
}

func NewPasskeyCRUD() *PasskeyCRUD {
	return &PasskeyCRUD{collection: GetCollection(PasskeysCollection)}
}

func (pc *PasskeyCRUD) Create(passkey *Passkey) error {
	ctx := context.Background()
	now := time.Now()
	passkey.CreatedAt = now
	passkey.UpdatedAt = now
	res, err := pc.collection.InsertOne(ctx, passkey)
	if err != nil {
		return fmt.Errorf("failed to create passkey: %w", err)
	}
	if oid, ok := res.InsertedID.(primitive.ObjectID); ok {
		passkey.ID = oid
	}
	return nil
}

func (pc *PasskeyCRUD) ListByUserID(userID string) ([]*Passkey, error) {
	ctx := context.Background()
	cur, err := pc.collection.Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("failed to list passkeys: %w", err)
	}
	defer cur.Close(ctx)

	var out []*Passkey
	for cur.Next(ctx) {
		var p Passkey
		if err := cur.Decode(&p); err != nil {
			return nil, fmt.Errorf("failed to decode passkey: %w", err)
		}
		out = append(out, &p)
	}
	if err := cur.Err(); err != nil {
		return nil, fmt.Errorf("cursor error: %w", err)
	}
	return out, nil
}

func (pc *PasskeyCRUD) DeleteByIDForUser(id primitive.ObjectID, userID string) error {
	ctx := context.Background()
	_, err := pc.collection.DeleteOne(ctx, bson.M{"_id": id, "user_id": userID})
	if err != nil {
		return fmt.Errorf("failed to delete passkey: %w", err)
	}
	return nil
}
