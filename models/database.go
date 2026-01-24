package models

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/beego/beego/v2/server/web"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	client *mongo.Client
	db     *mongo.Database
)

// Database configuration
const (
	DatabaseName          = "unified_id"
	UsersCollection       = "users"
	ServicesCollection    = "services"
	ServiceAppsCollection = "service_apps"
	SessionsCollection    = "sessions"
	SitesCollection       = "sites"
)

// InitDatabase initializes MongoDB connection
func InitDatabase() error {
	// Get MongoDB URI from environment or use localhost
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		mongoURI = web.AppConfig.DefaultString("mongodb_uri", "mongodb://localhost:27017")
	}

	dbName := DatabaseName
	if u, err := url.Parse(mongoURI); err == nil {
		name := strings.TrimPrefix(u.Path, "/")
		if name != "" {
			dbName = name
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var err error
	client, err = mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		return fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	// Ping the database to verify connection
	if err := client.Ping(ctx, nil); err != nil {
		return fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	db = client.Database(dbName)

	// Create indexes
	if err := createIndexes(); err != nil {
		return fmt.Errorf("failed to create indexes: %w", err)
	}

	log.Println("Connected to MongoDB successfully")
	return nil
}

// GetDatabase returns the database instance
func GetDatabase() *mongo.Database {
	return db
}

// GetCollection returns a collection
func GetCollection(name string) *mongo.Collection {
	return db.Collection(name)
}

// createIndexes creates necessary database indexes
func createIndexes() error {
	ctx := context.Background()

	// Users collection indexes
	usersCol := GetCollection(UsersCollection)
	usersIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "unified_id", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "external_id", Value: 1}}},
		{Keys: bson.D{{Key: "provider", Value: 1}}},
	}

	if _, err := usersCol.Indexes().CreateMany(ctx, usersIndexes); err != nil {
		return fmt.Errorf("failed to create users indexes: %w", err)
	}

	// Sessions collection indexes
	sessionsCol := GetCollection(SessionsCollection)
	sessionsIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "token", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "user_id", Value: 1}}},
		{Keys: bson.D{{Key: "expires_at", Value: 1}}, Options: options.Index().SetExpireAfterSeconds(0)},
	}

	if _, err := sessionsCol.Indexes().CreateMany(ctx, sessionsIndexes); err != nil {
		return fmt.Errorf("failed to create sessions indexes: %w", err)
	}

	// Service apps collection indexes
	serviceAppsCol := GetCollection(ServiceAppsCollection)
	serviceAppsIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "token_hash", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "owner_user_id", Value: 1}}},
		{Keys: bson.D{{Key: "name", Value: 1}}},
	}

	if _, err := serviceAppsCol.Indexes().CreateMany(ctx, serviceAppsIndexes); err != nil {
		return fmt.Errorf("failed to create service apps indexes: %w", err)
	}

	return nil
}

// CloseDatabase closes the database connection
func CloseDatabase() error {
	if client != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return client.Disconnect(ctx)
	}
	return nil
}
