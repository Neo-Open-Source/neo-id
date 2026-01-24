package controllers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type AdminController struct {
	web.Controller
}

// SetUserRole sets a user's role (Admin/Moderator/Developer/User). Only admin/moderator.
func (c *AdminController) SetUserRole() {
	actor, err := c.authenticateAdminOrModerator()
	if err != nil || actor == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized - admin/moderator access required"}
		c.ServeJSON()
		return
	}

	var requestData struct {
		UserID string `json:"user_id"`
		Role   string `json:"role"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Failed to read request body"}
		c.ServeJSON()
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid request body"}
		c.ServeJSON()
		return
	}
	role := strings.ToLower(strings.TrimSpace(requestData.Role))
	if requestData.UserID == "" || role == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "user_id and role are required"}
		c.ServeJSON()
		return
	}
	if role != "admin" && role != "moderator" && role != "developer" && role != "user" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "invalid role"}
		c.ServeJSON()
		return
	}

	userCRUD := models.NewUserCRUD()
	u, err := userCRUD.GetUserByUnifiedID(requestData.UserID)
	if err != nil || u == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
		c.Data["json"] = map[string]interface{}{"error": "user not found"}
		c.ServeJSON()
		return
	}
	u.Role = strings.Title(role)
	if err := userCRUD.UpdateUser(u); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "failed to set role"}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{"message": "role updated", "user_id": u.UnifiedID, "role": u.Role}
	c.ServeJSON()
}

// authenticateAdmin checks if user is admin

func (c *AdminController) authenticateAdmin() (*models.User, error) {
	token := c.Ctx.Request.Header.Get("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}

	if token == "" {
		return nil, nil
	}

	claims := &Claims{}
	jwtToken, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
		secret := os.Getenv("JWT_SECRET")
		if strings.TrimSpace(secret) == "" {
			secret = web.AppConfig.DefaultString("jwt_secret", "")
		}
		return []byte(secret), nil
	})
	if err != nil || !jwtToken.Valid {
		return nil, nil
	}

	sessionCRUD := models.NewSessionCRUD()
	session, err := sessionCRUD.GetSessionByToken(token)
	if err != nil || session == nil {
		return nil, nil
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(claims.UnifiedID)
	if err != nil || user == nil {
		return nil, nil
	}

	adminEmailsStr := web.AppConfig.DefaultString("admin_emails", "")
	if strings.TrimSpace(adminEmailsStr) == "" {
		adminEmailsStr = os.Getenv("ADMIN_EMAILS")
	}
	adminEmails := strings.Split(adminEmailsStr, ",")
	for i := range adminEmails {
		adminEmails[i] = strings.TrimSpace(adminEmails[i])
	}

	for _, adminEmail := range adminEmails {
		if adminEmail != "" && strings.EqualFold(user.Email, adminEmail) {
			return user, nil
		}
	}

	role := strings.ToLower(strings.TrimSpace(user.Role))
	if role == "admin" {
		return user, nil
	}

	return nil, nil
}

func (c *AdminController) authenticateAdminOrModerator() (*models.User, error) {
	admin, err := c.authenticateAdmin()
	if err != nil {
		return nil, err
	}
	if admin != nil {
		return admin, nil
	}

	token := c.Ctx.Request.Header.Get("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	if token == "" {
		return nil, nil
	}

	claims := &Claims{}
	jwtToken, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(web.AppConfig.DefaultString("jwt_secret", "")), nil
	})
	if err != nil || !jwtToken.Valid {
		return nil, nil
	}

	sessionCRUD := models.NewSessionCRUD()
	session, err := sessionCRUD.GetSessionByToken(token)
	if err != nil || session == nil {
		return nil, nil
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(claims.UnifiedID)
	if err != nil || user == nil {
		return nil, nil
	}

	role := strings.ToLower(strings.TrimSpace(user.Role))
	if role == "moderator" {
		return user, nil
	}

	moderatorEmailsStr := web.AppConfig.DefaultString("moderator_emails", "")
	if strings.TrimSpace(moderatorEmailsStr) == "" {
		moderatorEmailsStr = os.Getenv("MODERATOR_EMAILS")
	}
	moderatorEmails := strings.Split(moderatorEmailsStr, ",")
	for i := range moderatorEmails {
		moderatorEmails[i] = strings.TrimSpace(moderatorEmails[i])
	}
	for _, moderatorEmail := range moderatorEmails {
		if moderatorEmail != "" && strings.EqualFold(user.Email, moderatorEmail) {
			return user, nil
		}
	}

	return nil, nil
}

// GetUsers returns paginated list of users
func (c *AdminController) GetUsers() {
	actor, err := c.authenticateAdminOrModerator()
	if err != nil || actor == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - admin/moderator access required",
		}
		c.ServeJSON()
		return
	}

	// Parse pagination parameters
	page, _ := strconv.Atoi(c.GetString("page", "1"))
	limit, _ := strconv.Atoi(c.GetString("limit", "20"))
	search := c.GetString("search", "")
	isBanned := c.GetString("banned")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	skip := int64((page - 1) * limit)
	limit64 := int64(limit)

	// Build query
	filter := bson.M{}

	if search != "" {
		filter["$or"] = []bson.M{
			{"display_name": bson.M{"$regex": search, "$options": "i"}},
			{"email": bson.M{"$regex": search, "$options": "i"}},
			{"unified_id": bson.M{"$regex": search, "$options": "i"}},
		}
	}

	if isBanned != "" {
		filter["is_banned"] = isBanned == "true"
	}

	// Get users from database
	ctx := context.Background()
	userCRUD := models.NewUserCRUD()
	collection := userCRUD.Collection()

	// Count total users
	total, err := collection.CountDocuments(ctx, filter)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to count users: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	// Get users with pagination
	cursor, err := collection.Find(ctx, filter,
		&options.FindOptions{
			Skip:  &skip,
			Limit: &limit64,
			Sort:  bson.D{{Key: "created_at", Value: -1}},
		},
	)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to get users: " + err.Error(),
		}
		c.ServeJSON()
		return
	}
	defer cursor.Close(ctx)

	var users []models.User
	if err := cursor.All(ctx, &users); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to decode users: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	// Format response
	var usersData []map[string]interface{}
	for _, user := range users {
		userData := map[string]interface{}{
			"unified_id":         user.UnifiedID,
			"email":              user.Email,
			"display_name":       user.DisplayName,
			"avatar":             user.Avatar,
			"role":               user.Role,
			"provider":           user.Provider,
			"connected_services": user.ConnectedServices,
			"is_banned":          user.IsBanned,
			"ban_reason":         user.BanReason,
			"banned_until":       user.BannedUntil,
			"created_at":         user.CreatedAt,
			"last_login":         user.LastLogin,
		}
		usersData = append(usersData, userData)
	}

	c.Data["json"] = map[string]interface{}{
		"users": usersData,
		"pagination": map[string]interface{}{
			"page":  page,
			"limit": limit,
			"total": total,
			"pages": (total + int64(limit) - 1) / int64(limit),
		},
	}
	c.ServeJSON()
}

// BanUser bans a user
func (c *AdminController) BanUser() {
	actor, err := c.authenticateAdminOrModerator()
	if err != nil || actor == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - admin/moderator access required",
		}
		c.ServeJSON()
		return
	}

	var requestData struct {
		UserID   string `json:"user_id"`
		Reason   string `json:"reason"`
		Duration string `json:"duration"` // "permanent", "7d", "30d", etc.
	}

	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to read request body",
		}
		c.ServeJSON()
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid request body",
		}
		c.ServeJSON()
		return
	}

	if requestData.UserID == "" || requestData.Reason == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "user_id and reason are required",
		}
		c.ServeJSON()
		return
	}

	// Parse duration
	var bannedUntil *time.Time
	if requestData.Duration != "permanent" {
		duration, err := time.ParseDuration(requestData.Duration)
		if err == nil {
			now := time.Now()
			bannedUntilTime := now.Add(duration)
			bannedUntil = &bannedUntilTime
		}
	}

	// Ban user
	userCRUD := models.NewUserCRUD()
	if err := userCRUD.BanUser(requestData.UserID, requestData.Reason, bannedUntil); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to ban user: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	// Delete all user sessions
	sessionCRUD := models.NewSessionCRUD()
	if err := sessionCRUD.DeleteUserSessions(requestData.UserID); err != nil {
		// Log error but don't fail the request
		// TODO: Add proper logging
	}

	response := map[string]interface{}{
		"message": "User banned successfully",
		"user_id": requestData.UserID,
		"reason":  requestData.Reason,
	}

	if bannedUntil != nil {
		response["banned_until"] = bannedUntil
	} else {
		response["banned_until"] = "permanent"
	}

	c.Data["json"] = response
	c.ServeJSON()
}

// UnbanUser unbans a user
func (c *AdminController) UnbanUser() {
	actor, err := c.authenticateAdminOrModerator()
	if err != nil || actor == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - admin/moderator access required",
		}
		c.ServeJSON()
		return
	}

	var requestData struct {
		UserID string `json:"user_id"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to read request body",
		}
		c.ServeJSON()
		return
	}

	if err := json.Unmarshal(body, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid request body",
		}
		c.ServeJSON()
		return
	}

	if requestData.UserID == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "user_id is required",
		}
		c.ServeJSON()
		return
	}

	// Unban user
	userCRUD := models.NewUserCRUD()
	if err := userCRUD.UnbanUser(requestData.UserID); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to unban user: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"message": "User unbanned successfully",
		"user_id": requestData.UserID,
	}
	c.ServeJSON()
}

// GetServices returns all services
func (c *AdminController) GetServices() {
	actor, err := c.authenticateAdminOrModerator()
	if err != nil || actor == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - admin/moderator access required",
		}
		c.ServeJSON()
		return
	}

	serviceCRUD := models.NewServiceCRUD()
	services, err := serviceCRUD.GetAllActiveServices()
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to get services: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"services": services,
	}
	c.ServeJSON()
}

// CreateService creates a new service
func (c *AdminController) CreateService() {
	actor, err := c.authenticateAdminOrModerator()
	if err != nil || actor == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - admin/moderator access required",
		}
		c.ServeJSON()
		return
	}

	var service models.Service
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to read request body",
		}
		c.ServeJSON()
		return
	}
	if err := json.Unmarshal(body, &service); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid request body",
		}
		c.ServeJSON()
		return
	}

	if service.Name == "" || service.DisplayName == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "name and display_name are required",
		}
		c.ServeJSON()
		return
	}

	// Check if service already exists
	serviceCRUD := models.NewServiceCRUD()
	existingService, err := serviceCRUD.GetServiceByName(service.Name)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to check existing service: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	if existingService != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusConflict)
		c.Data["json"] = map[string]interface{}{
			"error": "Service already exists",
		}
		c.ServeJSON()
		return
	}

	// Create service
	service.IsActive = true
	if err := serviceCRUD.CreateService(&service); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to create service: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"message": "Service created successfully",
		"service": service,
	}
	c.ServeJSON()
}

func (c *AdminController) GetSites() {
	actor, err := c.authenticateAdminOrModerator()
	if err != nil || actor == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - admin/moderator access required",
		}
		c.ServeJSON()
		return
	}

	ctx := context.Background()
	siteCRUD := models.NewSiteCRUD()
	collection := siteCRUD.Collection()

	cursor, err := collection.Find(ctx, bson.M{}, &options.FindOptions{Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to get sites: " + err.Error(),
		}
		c.ServeJSON()
		return
	}
	defer cursor.Close(ctx)

	var sites []models.Site
	if err := cursor.All(ctx, &sites); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to decode sites: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"sites": sites,
	}
	c.ServeJSON()
}

// AdminIndex serves admin dashboard
func (c *AdminController) AdminIndex() {
	// Serve admin dashboard HTML
	// TODO: Implement admin dashboard frontend
	c.Data["title"] = "Admin Dashboard - Unified ID"
	c.TplName = "admin.html"
}
