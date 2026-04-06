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

// SessionCRUD operations
type SessionCRUD struct {
	collection *mongo.Collection
}

func NewSessionCRUD() *SessionCRUD {
	return &SessionCRUD{
		collection: GetCollection(SessionsCollection),
	}
}

// CreateSession creates a new session
func (sc *SessionCRUD) CreateSession(session *Session) error {
	ctx := context.Background()
	session.CreatedAt = time.Now()

	result, err := sc.collection.InsertOne(ctx, session)
	if err != nil {
		return fmt.Errorf("failed to create session: %w", err)
	}

	session.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetSessionByToken gets session by token
func (sc *SessionCRUD) GetSessionByToken(token string) (*Session, error) {
	ctx := context.Background()
	var session Session

	err := sc.collection.FindOne(ctx, bson.M{
		"token":      token,
		"expires_at": bson.M{"$gt": time.Now()},
	}).Decode(&session)

	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}

	return &session, nil
}

// SetGeo updates country and city for a session
func (sc *SessionCRUD) SetGeo(token, country, city string) error {
	ctx := context.Background()
	_, err := sc.collection.UpdateOne(ctx,
		bson.M{"token": token},
		bson.M{"$set": bson.M{"country": country, "city": city}},
	)
	return err
}

// UpdateAllSessionsDuration updates refresh_expires_at for all active sessions of a user
// based on new duration. Each session gets: created_at + N months.
func (sc *SessionCRUD) UpdateAllSessionsDuration(userID string, months int) error {
	ctx := context.Background()
	sessions, err := sc.GetUserSessions(userID)
	if err != nil {
		return err
	}
	for _, s := range sessions {
		newExp := s.CreatedAt.AddDate(0, months, 0)
		_, _ = sc.collection.UpdateOne(ctx,
			bson.M{"_id": s.ID},
			bson.M{"$set": bson.M{
				"refresh_expires_at":      newExp,
				"refresh_duration_months": months,
			}},
		)
	}
	return nil
}

// GetSessionByRefreshToken gets session by refresh token
func (sc *SessionCRUD) GetSessionByRefreshToken(refreshToken string) (*Session, error) {
	ctx := context.Background()
	var session Session
	err := sc.collection.FindOne(ctx, bson.M{
		"refresh_token":      refreshToken,
		"refresh_expires_at": bson.M{"$gt": time.Now()},
	}).Decode(&session)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get session by refresh token: %w", err)
	}
	return &session, nil
}

// GetUserSessions returns all active sessions for a user
func (sc *SessionCRUD) GetUserSessions(userID string) ([]Session, error) {
	ctx := context.Background()
	cursor, err := sc.collection.Find(ctx, bson.M{
		"user_id":    userID,
		"expires_at": bson.M{"$gt": time.Now()},
	})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var sessions []Session
	_ = cursor.All(ctx, &sessions)
	return sessions, nil
}

// UpdateSessionTokens replaces access token and updates last_used_at
func (sc *SessionCRUD) UpdateSessionTokens(oldToken, newToken string, newExpiry time.Time) error {
	ctx := context.Background()
	_, err := sc.collection.UpdateOne(ctx,
		bson.M{"token": oldToken},
		bson.M{"$set": bson.M{
			"token":        newToken,
			"expires_at":   newExpiry,
			"last_used_at": time.Now(),
		}},
	)
	return err
}

// TouchSession updates last_used_at and optionally rolls refresh token
func (sc *SessionCRUD) TouchSession(token string) error {
	ctx := context.Background()
	_, err := sc.collection.UpdateOne(ctx,
		bson.M{"token": token},
		bson.M{"$set": bson.M{"last_used_at": time.Now()}},
	)
	return err
}

// RevokeSession deletes a specific session by ID (for session management UI)
func (sc *SessionCRUD) RevokeSessionByID(id primitive.ObjectID, userID string) error {
	ctx := context.Background()
	_, err := sc.collection.DeleteOne(ctx, bson.M{"_id": id, "user_id": userID})
	return err
}

// DeleteSession deletes a session
func (sc *SessionCRUD) DeleteSession(token string) error {
	ctx := context.Background()

	_, err := sc.collection.DeleteOne(ctx, bson.M{"token": token})
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	return nil
}

// DeleteUserSessions deletes all sessions for a user
func (sc *SessionCRUD) DeleteUserSessions(userID string) error {
	ctx := context.Background()

	_, err := sc.collection.DeleteMany(ctx, bson.M{"user_id": userID})
	if err != nil {
		return fmt.Errorf("failed to delete user sessions: %w", err)
	}

	return nil
}

// CountUserSessions counts active (non-expired) sessions for a user
func (sc *SessionCRUD) CountUserSessions(userID string) (int, error) {
	ctx := context.Background()
	count, err := sc.collection.CountDocuments(ctx, bson.M{
		"user_id":    userID,
		"expires_at": bson.M{"$gt": time.Now()},
	})
	if err != nil {
		return 0, fmt.Errorf("failed to count user sessions: %w", err)
	}
	return int(count), nil
}

// DeleteOldestSession deletes the active session with the oldest last_used_at for a user
func (sc *SessionCRUD) DeleteOldestSession(userID string) error {
	ctx := context.Background()
	var oldest Session
	opts := options.FindOne().SetSort(bson.D{{Key: "last_used_at", Value: 1}})
	err := sc.collection.FindOne(ctx, bson.M{
		"user_id":    userID,
		"expires_at": bson.M{"$gt": time.Now()},
	}, opts).Decode(&oldest)
	if err == mongo.ErrNoDocuments {
		return nil
	}
	if err != nil {
		return fmt.Errorf("failed to find oldest session: %w", err)
	}
	_, err = sc.collection.DeleteOne(ctx, bson.M{"_id": oldest.ID})
	if err != nil {
		return fmt.Errorf("failed to delete oldest session: %w", err)
	}
	return nil
}

// DeleteUserSessionsExcept deletes all sessions for a user except the one with the given token
func (sc *SessionCRUD) DeleteUserSessionsExcept(userID, exceptToken string) error {
	ctx := context.Background()
	_, err := sc.collection.DeleteMany(ctx, bson.M{
		"user_id": userID,
		"token":   bson.M{"$ne": exceptToken},
	})
	if err != nil {
		return fmt.Errorf("failed to delete user sessions: %w", err)
	}
	return nil
}

// CleanupExpiredSessions removes expired sessions
func (sc *SessionCRUD) CleanupExpiredSessions() error {
	ctx := context.Background()

	_, err := sc.collection.DeleteMany(ctx, bson.M{
		"expires_at": bson.M{"$lt": time.Now()},
	})

	if err != nil {
		return fmt.Errorf("failed to cleanup expired sessions: %w", err)
	}

	return nil
}

// ServiceCRUD operations
type ServiceCRUD struct {
	collection *mongo.Collection
}

func NewServiceCRUD() *ServiceCRUD {
	return &ServiceCRUD{
		collection: GetCollection(ServicesCollection),
	}
}

// CreateService creates a new service
func (sc *ServiceCRUD) CreateService(service *Service) error {
	ctx := context.Background()
	service.CreatedAt = time.Now()

	result, err := sc.collection.InsertOne(ctx, service)
	if err != nil {
		return fmt.Errorf("failed to create service: %w", err)
	}

	service.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

// GetServiceByName gets service by name
func (sc *ServiceCRUD) GetServiceByName(name string) (*Service, error) {
	ctx := context.Background()
	var service Service

	err := sc.collection.FindOne(ctx, bson.M{"name": name}).Decode(&service)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get service: %w", err)
	}

	return &service, nil
}

// GetAllActiveServices gets all active services
func (sc *ServiceCRUD) GetAllActiveServices() ([]Service, error) {
	ctx := context.Background()

	cursor, err := sc.collection.Find(ctx, bson.M{"is_active": true})
	if err != nil {
		return nil, fmt.Errorf("failed to get services: %w", err)
	}
	defer cursor.Close(ctx)

	var services []Service
	if err := cursor.All(ctx, &services); err != nil {
		return nil, fmt.Errorf("failed to decode services: %w", err)
	}

	return services, nil
}
