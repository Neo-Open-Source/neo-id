package models

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
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
		"token": token,
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
