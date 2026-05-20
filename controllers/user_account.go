package controllers

import (
  "net/http"

  "unified-id/models"
)

// DeleteAccount deletes the authenticated account and all directly owned user data.
func (c *UserController) DeleteAccount() {
  user, err := c.authenticateUser()
  if err != nil || user == nil {
    respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
    return
  }

  if err := models.NewServiceAppCRUD().DeleteByOwner(user.UnifiedID); err != nil {
    respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete service apps")
    return
  }
  if err := models.NewSessionCRUD().DeleteUserSessions(user.UnifiedID); err != nil {
    respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete sessions")
    return
  }
  if err := models.NewUserCRUD().DeleteByUnifiedID(user.UnifiedID); err != nil {
    respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete user")
    return
  }

  c.Data["json"] = map[string]interface{}{"deleted": true}
  c.ServeJSON()
}
