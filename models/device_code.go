package models

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const DeviceCodesCollection = "device_codes"

// DeviceCode represents a TV/device login session.
// Status: "pending" → "confirmed" | "expired"
type DeviceCode struct {
	ID         primitive.ObjectID `bson:"_id,omitempty"`
	DeviceCode string             `bson:"device_code"` // opaque, sent to TV
	UserCode   string             `bson:"user_code"`   // 6-char, shown to user
	UserID     string             `bson:"user_id,omitempty"`
	Status     string             `bson:"status"` // pending | confirmed | expired
	ExpiresAt  time.Time          `bson:"expires_at"`
	CreatedAt  time.Time          `bson:"created_at"`
}

type DeviceCodeCRUD struct {
	col *mongo.Collection
}

func NewDeviceCodeCRUD() *DeviceCodeCRUD {
	col := GetCollection(DeviceCodesCollection)
	// Ensure TTL index exists (best-effort)
	col.Indexes().CreateOne(context.Background(), mongo.IndexModel{
		Keys:    bson.D{{Key: "expires_at", Value: 1}},
		Options: options.Index().SetExpireAfterSeconds(0),
	})
	col.Indexes().CreateOne(context.Background(), mongo.IndexModel{
		Keys:    bson.D{{Key: "device_code", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	col.Indexes().CreateOne(context.Background(), mongo.IndexModel{
		Keys:    bson.D{{Key: "user_code", Value: 1}},
	})
	return &DeviceCodeCRUD{col: col}
}

// generateUserCode returns a random 6-char alphanumeric code (uppercase, no ambiguous chars).
func generateUserCode() (string, error) {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	code := make([]byte, 6)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", err
		}
		code[i] = chars[n.Int64()]
	}
	return string(code), nil
}

// generateDeviceCode returns a random 40-char hex device code.
func generateDeviceCodeToken() (string, error) {
	b := make([]byte, 20)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", b), nil
}

func (d *DeviceCodeCRUD) Create() (*DeviceCode, error) {
	userCode, err := generateUserCode()
	if err != nil {
		return nil, err
	}
	deviceCode, err := generateDeviceCodeToken()
	if err != nil {
		return nil, err
	}
	dc := &DeviceCode{
		DeviceCode: deviceCode,
		UserCode:   userCode,
		Status:     "pending",
		ExpiresAt:  time.Now().Add(5 * time.Minute),
		CreatedAt:  time.Now(),
	}
	res, err := d.col.InsertOne(context.Background(), dc)
	if err != nil {
		return nil, fmt.Errorf("failed to create device code: %w", err)
	}
	dc.ID = res.InsertedID.(primitive.ObjectID)
	return dc, nil
}

func (d *DeviceCodeCRUD) GetByDeviceCode(deviceCode string) (*DeviceCode, error) {
	var dc DeviceCode
	err := d.col.FindOne(context.Background(), bson.M{"device_code": deviceCode}).Decode(&dc)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	return &dc, err
}

func (d *DeviceCodeCRUD) GetByUserCode(userCode string) (*DeviceCode, error) {
	var dc DeviceCode
	err := d.col.FindOne(context.Background(), bson.M{
		"user_code": userCode,
		"status":    "pending",
		"expires_at": bson.M{"$gt": time.Now()},
	}).Decode(&dc)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	return &dc, err
}

func (d *DeviceCodeCRUD) Confirm(deviceCode, userID string) error {
	_, err := d.col.UpdateOne(context.Background(),
		bson.M{"device_code": deviceCode, "status": "pending"},
		bson.M{"$set": bson.M{"status": "confirmed", "user_id": userID}},
	)
	return err
}
