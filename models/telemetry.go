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

type TelemetryEvent struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    string             `bson:"user_id,omitempty" json:"user_id,omitempty"`
	Email     string             `bson:"email,omitempty" json:"email,omitempty"`
	Route     string             `bson:"route,omitempty" json:"route,omitempty"`
	Message   string             `bson:"message" json:"message"`
	Details   string             `bson:"details,omitempty" json:"details,omitempty"`
	UserAgent string             `bson:"user_agent,omitempty" json:"user_agent,omitempty"`
	IP        string             `bson:"ip,omitempty" json:"ip,omitempty"`
	Status    string             `bson:"status,omitempty" json:"status,omitempty"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}

type TelemetryCRUD struct {
	collection *mongo.Collection
}

func NewTelemetryCRUD() *TelemetryCRUD {
	return &TelemetryCRUD{collection: GetCollection(TelemetryEventsCollection)}
}

func (tc *TelemetryCRUD) Create(event *TelemetryEvent) error {
	ctx := context.Background()
	event.CreatedAt = time.Now()
	if event.Status == "" {
		event.Status = "new"
	}
	res, err := tc.collection.InsertOne(ctx, event)
	if err != nil {
		return fmt.Errorf("failed to create telemetry event: %w", err)
	}
	if oid, ok := res.InsertedID.(primitive.ObjectID); ok {
		event.ID = oid
	}
	return nil
}

func (tc *TelemetryCRUD) List(limit int64, status string) ([]TelemetryEvent, error) {
	ctx := context.Background()
	filter := bson.M{}
	if status != "" {
		filter["status"] = status
	}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}}).SetLimit(limit)
	cur, err := tc.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to list telemetry: %w", err)
	}
	defer cur.Close(ctx)

	var rows []TelemetryEvent
	if err := cur.All(ctx, &rows); err != nil {
		return nil, fmt.Errorf("failed to decode telemetry: %w", err)
	}
	return rows, nil
}
