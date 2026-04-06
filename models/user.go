package models

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// User represents a unified user account
type User struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UnifiedID   string             `bson:"unified_id" json:"unified_id"` // Unique unified ID
	Email       string             `bson:"email" json:"email"`
	DisplayName string             `bson:"display_name" json:"display_name"`
	Avatar      string             `bson:"avatar" json:"avatar"`
	Role        string             `bson:"role,omitempty" json:"role,omitempty"`

	// OAuth provider info
	Provider    string `bson:"provider" json:"provider"`                             // legacy single provider
	ExternalID  string `bson:"external_id" json:"external_id"`                       // legacy single provider
	AccessToken string `bson:"access_token,omitempty" json:"access_token,omitempty"` // legacy single provider

	OAuthProviders []OAuthProvider `bson:"oauth_providers,omitempty" json:"oauth_providers,omitempty"`
	PasswordHash   string          `bson:"password_hash,omitempty" json:"-"`
	EmailVerified  bool            `bson:"email_verified,omitempty" json:"email_verified,omitempty"`

	EmailVerificationToken     string     `bson:"email_verification_token,omitempty" json:"-"`
	EmailVerificationExpiresAt *time.Time `bson:"email_verification_expires_at,omitempty" json:"-"`
	EmailVerificationCode      string     `bson:"email_verification_code,omitempty" json:"-"`
	EmailVerificationCodeExpAt *time.Time `bson:"email_verification_code_expires_at,omitempty" json:"-"`

	// Profile info
	FirstName string `bson:"first_name,omitempty" json:"first_name,omitempty"`
	LastName  string `bson:"last_name,omitempty" json:"last_name,omitempty"`
	Location  string `bson:"location,omitempty" json:"location,omitempty"`
	Bio       string `bson:"bio,omitempty" json:"bio,omitempty"`

	// MFA / TOTP
	TOTPSecret            string `bson:"totp_secret,omitempty" json:"-"`
	TOTPEnabled           bool   `bson:"totp_enabled,omitempty" json:"totp_enabled,omitempty"`
	EmailMFAEnabled       bool   `bson:"email_mfa_enabled,omitempty" json:"email_mfa_enabled,omitempty"`
	RefreshDurationMonths int    `bson:"refresh_duration_months,omitempty" json:"refresh_duration_months,omitempty"`

	// Status
	IsBanned    bool       `bson:"is_banned" json:"is_banned"`
	BannedUntil *time.Time `bson:"banned_until,omitempty" json:"banned_until,omitempty"`
	BanReason   string     `bson:"ban_reason,omitempty" json:"ban_reason,omitempty"`

	// Connected services
	ConnectedServices []string `bson:"connected_services" json:"connected_services"` // example_service_a, example_service_b

	// Timestamps
	CreatedAt time.Time  `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time  `bson:"updated_at" json:"updated_at"`
	LastLogin *time.Time `bson:"last_login,omitempty" json:"last_login,omitempty"`
}

type OAuthProvider struct {
	Provider    string    `bson:"provider" json:"provider"`
	ExternalID  string    `bson:"external_id" json:"external_id"`
	AccessToken string    `bson:"access_token,omitempty" json:"access_token,omitempty"`
	AddedAt     time.Time `bson:"added_at" json:"added_at"`
}

// Service represents a connected service (NeoMovies, NeoMe)
type Service struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name        string             `bson:"name" json:"name"` // example_service_a, example_service_b
	DisplayName string             `bson:"display_name" json:"display_name"`
	Description string             `bson:"description" json:"description"`
	LogoURL     string             `bson:"logo_url" json:"logo_url"`
	IsActive    bool               `bson:"is_active" json:"is_active"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
}

// Session represents a user session
type Session struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Token     string             `bson:"token" json:"token"`
	UserID    string             `bson:"user_id" json:"user_id"`
	ExpiresAt time.Time          `bson:"expires_at" json:"expires_at"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
	IPAddress string             `bson:"ip_address,omitempty" json:"ip_address,omitempty"`
	UserAgent string             `bson:"user_agent,omitempty" json:"user_agent,omitempty"`
	Country   string             `bson:"country,omitempty" json:"country,omitempty"`
	City      string             `bson:"city,omitempty" json:"city,omitempty"`

	// Refresh token
	RefreshToken          string    `bson:"refresh_token,omitempty" json:"refresh_token,omitempty"`
	RefreshExpiresAt      time.Time `bson:"refresh_expires_at,omitempty" json:"refresh_expires_at,omitempty"`
	RefreshDurationMonths int       `bson:"refresh_duration_months,omitempty" json:"refresh_duration_months,omitempty"`
	LastUsedAt            time.Time `bson:"last_used_at,omitempty" json:"last_used_at,omitempty"`
}

// UserCRUD operations
type UserCRUD struct {
	collection *mongo.Collection
}

func NewUserCRUD() *UserCRUD {
	return &UserCRUD{
		collection: GetCollection(UsersCollection),
	}
}

func (uc *UserCRUD) Collection() *mongo.Collection {
	return uc.collection
}

// CreateUser creates a new user
func (uc *UserCRUD) CreateUser(user *User) error {
	ctx := context.Background()
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	result, err := uc.collection.InsertOne(ctx, user)
	if err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	user.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetUserByProvider gets user by OAuth provider and external ID
func (uc *UserCRUD) GetUserByProvider(provider, externalID string) (*User, error) {
	ctx := context.Background()
	var user User

	err := uc.collection.FindOne(ctx, bson.M{
		"$or": []bson.M{
			{
				"provider":    provider,
				"external_id": externalID,
			},
			{
				"oauth_providers": bson.M{
					"$elemMatch": bson.M{
						"provider":    provider,
						"external_id": externalID,
					},
				},
			},
		},
	}).Decode(&user)

	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

func (uc *UserCRUD) GetUserByEmailVerificationToken(token string) (*User, error) {
	ctx := context.Background()
	var user User

	err := uc.collection.FindOne(ctx, bson.M{"email_verification_token": token}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

// GetUserByEmail gets user by email
func (uc *UserCRUD) GetUserByEmail(email string) (*User, error) {
	ctx := context.Background()
	var user User

	err := uc.collection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

// GetUserByUnifiedID gets user by unified ID
func (uc *UserCRUD) GetUserByUnifiedID(unifiedID string) (*User, error) {
	ctx := context.Background()
	var user User

	err := uc.collection.FindOne(ctx, bson.M{"unified_id": unifiedID}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	return &user, nil
}

// UpdateUser updates user information
func (uc *UserCRUD) UpdateUser(user *User) error {
	ctx := context.Background()
	user.UpdatedAt = time.Now()

	_, err := uc.collection.UpdateOne(
		ctx,
		bson.M{"_id": user.ID},
		bson.M{"$set": user},
	)

	if err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// BanUser bans a user
func (uc *UserCRUD) BanUser(userID string, reason string, until *time.Time) error {
	ctx := context.Background()

	update := bson.M{
		"$set": bson.M{
			"is_banned":  true,
			"ban_reason": reason,
			"updated_at": time.Now(),
		},
	}

	if until != nil {
		update["$set"].(bson.M)["banned_until"] = until
	}

	_, err := uc.collection.UpdateOne(
		ctx,
		bson.M{"unified_id": userID},
		update,
	)

	if err != nil {
		return fmt.Errorf("failed to ban user: %w", err)
	}

	return nil
}

// UnbanUser unbans a user
func (uc *UserCRUD) UnbanUser(userID string) error {
	ctx := context.Background()

	_, err := uc.collection.UpdateOne(
		ctx,
		bson.M{"unified_id": userID},
		bson.M{
			"$set": bson.M{
				"is_banned":    false,
				"ban_reason":   "",
				"banned_until": nil,
				"updated_at":   time.Now(),
			},
		},
	)

	if err != nil {
		return fmt.Errorf("failed to unban user: %w", err)
	}

	return nil
}

// AddConnectedService adds a connected service to user
func (uc *UserCRUD) AddConnectedService(userID, serviceName string) error {
	ctx := context.Background()

	_, err := uc.collection.UpdateOne(
		ctx,
		bson.M{"unified_id": userID},
		bson.M{
			"$addToSet": bson.M{"connected_services": serviceName},
			"$set":      bson.M{"updated_at": time.Now()},
		},
	)

	if err != nil {
		return fmt.Errorf("failed to add connected service: %w", err)
	}

	return nil
}

// RemoveConnectedService removes a connected service from user
func (uc *UserCRUD) RemoveConnectedService(userID, serviceName string) error {
	ctx := context.Background()

	_, err := uc.collection.UpdateOne(
		ctx,
		bson.M{"unified_id": userID},
		bson.M{
			"$pull": bson.M{"connected_services": serviceName},
			"$set":  bson.M{"updated_at": time.Now()},
		},
	)

	if err != nil {
		return fmt.Errorf("failed to remove connected service: %w", err)
	}

	return nil
}
