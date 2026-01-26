package models

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// Site represents a registered site/service
type Site struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	SiteID      string             `bson:"site_id" json:"site_id"`       // Unique site identifier
	Name        string             `bson:"name" json:"name"`             // Site name
	Domain      string             `bson:"domain" json:"domain"`         // Primary domain
	APIKey      string             `bson:"api_key" json:"api_key"`       // API key for service
	APISecret   string             `bson:"api_secret" json:"api_secret"` // API secret
	Description string             `bson:"description" json:"description"`
	LogoURL     string             `bson:"logo_url" json:"logo_url"`

	// Configuration
	AllowedOrigins []string `bson:"allowed_origins" json:"allowed_origins"` // CORS allowed origins
	RedirectURI    string   `bson:"redirect_uri" json:"redirect_uri"`       // OAuth redirect URI

	// Status
	IsActive  bool      `bson:"is_active" json:"is_active"`
	CreatedAt time.Time `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`

	// Owner info
	OwnerEmail string `bson:"owner_email" json:"owner_email"`
	Plan       string `bson:"plan" json:"plan"` // free, pro, enterprise
}

// UserSiteConnection represents connection between user and site
type UserSiteConnection struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID      string             `bson:"user_id" json:"user_id"`
	SiteID      string             `bson:"site_id" json:"site_id"`
	SiteName    string             `bson:"site_name" json:"site_name"`
	ConnectedAt time.Time          `bson:"connected_at" json:"connected_at"`
	LastAccess  *time.Time         `bson:"last_access,omitempty" json:"last_access,omitempty"`
	IsActive    bool               `bson:"is_active" json:"is_active"`
}

// SiteCRUD operations
type SiteCRUD struct {
	collection *mongo.Collection
}

func NewSiteCRUD() *SiteCRUD {
	return &SiteCRUD{
		collection: GetCollection(SitesCollection),
	}
}

func (sc *SiteCRUD) Collection() *mongo.Collection {
	return sc.collection
}

// CreateSite creates a new site
func (sc *SiteCRUD) CreateSite(site *Site) error {
	ctx := context.Background()
	site.CreatedAt = time.Now()
	site.UpdatedAt = time.Now()

	result, err := sc.collection.InsertOne(ctx, site)
	if err != nil {
		return fmt.Errorf("failed to create site: %w", err)
	}

	site.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetSiteBySiteID gets site by site_id
func (sc *SiteCRUD) GetSiteBySiteID(siteID string) (*Site, error) {
	ctx := context.Background()
	var site Site

	err := sc.collection.FindOne(ctx, bson.M{"site_id": siteID}).Decode(&site)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get site: %w", err)
	}

	return &site, nil
}

// GetSiteByAPIKey gets site by API key
func (sc *SiteCRUD) GetSiteByAPIKey(apiKey string) (*Site, error) {
	ctx := context.Background()
	var site Site

	err := sc.collection.FindOne(ctx, bson.M{"api_key": apiKey}).Decode(&site)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get site: %w", err)
	}

	return &site, nil
}

// GetSiteByDomain gets site by domain
func (sc *SiteCRUD) GetSiteByDomain(domain string) (*Site, error) {
	ctx := context.Background()
	var site Site

	err := sc.collection.FindOne(ctx, bson.M{"domain": domain}).Decode(&site)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get site: %w", err)
	}

	return &site, nil
}

// UpdateSite updates site information
func (sc *SiteCRUD) UpdateSite(site *Site) error {
	ctx := context.Background()
	site.UpdatedAt = time.Now()

	_, err := sc.collection.UpdateOne(
		ctx,
		bson.M{"_id": site.ID},
		bson.M{"$set": site},
	)

	if err != nil {
		return fmt.Errorf("failed to update site: %w", err)
	}

	return nil
}

// DeleteSite deletes a site by site_id
func (sc *SiteCRUD) DeleteSite(siteID string) error {
	ctx := context.Background()

	_, err := sc.collection.DeleteOne(ctx, bson.M{"site_id": siteID})
	if err != nil {
		return fmt.Errorf("failed to delete site: %w", err)
	}

	return nil
}

// UserSiteConnectionCRUD operations
type UserSiteConnectionCRUD struct {
	collection *mongo.Collection
}

func NewUserSiteConnectionCRUD() *UserSiteConnectionCRUD {
	return &UserSiteConnectionCRUD{
		collection: GetCollection("user_site_connections"),
	}
}

// ConnectUserToSite connects a user to a site
func (usc *UserSiteConnectionCRUD) ConnectUserToSite(userID, siteID, siteName string) error {
	ctx := context.Background()

	// Check if connection already exists
	var existing UserSiteConnection
	err := usc.collection.FindOne(ctx, bson.M{
		"user_id": userID,
		"site_id": siteID,
	}).Decode(&existing)

	if err == nil {
		// Connection exists, just update last access
		now := time.Now()
		_, err = usc.collection.UpdateOne(
			ctx,
			bson.M{"_id": existing.ID},
			bson.M{
				"$set": bson.M{
					"last_access": now,
					"is_active":   true,
				},
			},
		)
		return err
	}

	// Create new connection
	connection := &UserSiteConnection{
		UserID:      userID,
		SiteID:      siteID,
		SiteName:    siteName,
		ConnectedAt: time.Now(),
		LastAccess:  &[]time.Time{time.Now()}[0],
		IsActive:    true,
	}

	_, err = usc.collection.InsertOne(ctx, connection)
	return err
}

// DisconnectUserFromSite disconnects a user from a site
func (usc *UserSiteConnectionCRUD) DisconnectUserFromSite(userID, siteID string) error {
	ctx := context.Background()

	_, err := usc.collection.UpdateOne(
		ctx,
		bson.M{
			"user_id": userID,
			"site_id": siteID,
		},
		bson.M{
			"$set": bson.M{
				"is_active": false,
			},
		},
	)

	return err
}

// GetUserConnections gets all active connections for a user
func (usc *UserSiteConnectionCRUD) GetUserConnections(userID string) ([]UserSiteConnection, error) {
	ctx := context.Background()

	cursor, err := usc.collection.Find(ctx, bson.M{
		"user_id":   userID,
		"is_active": true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get connections: %w", err)
	}
	defer cursor.Close(ctx)

	var connections []UserSiteConnection
	if err := cursor.All(ctx, &connections); err != nil {
		return nil, fmt.Errorf("failed to decode connections: %w", err)
	}

	return connections, nil
}

// GetSiteUsers gets all users connected to a site
func (usc *UserSiteConnectionCRUD) GetSiteUsers(siteID string) ([]UserSiteConnection, error) {
	ctx := context.Background()

	cursor, err := usc.collection.Find(ctx, bson.M{
		"site_id":   siteID,
		"is_active": true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get site users: %w", err)
	}
	defer cursor.Close(ctx)

	var connections []UserSiteConnection
	if err := cursor.All(ctx, &connections); err != nil {
		return nil, fmt.Errorf("failed to decode connections: %w", err)
	}

	return connections, nil
}

// UpdateLastAccess updates last access time for a connection
func (usc *UserSiteConnectionCRUD) UpdateLastAccess(userID, siteID string) error {
	ctx := context.Background()
	now := time.Now()

	_, err := usc.collection.UpdateOne(
		ctx,
		bson.M{
			"user_id":   userID,
			"site_id":   siteID,
			"is_active": true,
		},
		bson.M{
			"$set": bson.M{
				"last_access": now,
			},
		},
	)

	return err
}
