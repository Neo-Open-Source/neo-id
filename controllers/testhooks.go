package controllers

import "unified-id/models"

// TestHookGenerateSiteID exposes generateSiteID for external tests.
func TestHookGenerateSiteID() string {
	return generateSiteID()
}

// TestHookVerifyCodeChallenge exposes verifyCodeChallenge for external tests.
func TestHookVerifyCodeChallenge(verifier, challenge, method string) bool {
	return verifyCodeChallenge(verifier, challenge, method)
}

// TestHookGenerateIDToken exposes generateIDToken for external tests.
func TestHookGenerateIDToken(user *models.User, site *models.Site, nonce string) (string, error) {
	return generateIDToken(user, site, nonce)
}
