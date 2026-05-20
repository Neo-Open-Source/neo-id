package handlers

import (
	"encoding/json"
	"unified-id/internal/services"
	"unified-id/pkg/logger"

	"github.com/beego/beego/v2/server/web/context"
)

type ABTestingHandler struct {
	service *services.ABTestingService
}

func NewABTestingHandler() *ABTestingHandler {
	return &ABTestingHandler{
		service: services.GetABTestingService(),
	}
}

type CreateExperimentRequest struct {
	Name     string                `json:"name"`
	Variants []services.Variant    `json:"variants"`
}

func (h *ABTestingHandler) CreateExperiment(ctx *context.Context) {
	var req CreateExperimentRequest
	if err := json.Unmarshal(ctx.Input.RequestBody, &req); err != nil {
		logger.Errorf("Failed to parse request: %v", err)
		ctx.Output.SetStatus(400)
		ctx.Output.JSON(map[string]string{"error": "Invalid request body"}, false, false)
		return
	}

	if req.Name == "" {
		ctx.Output.SetStatus(400)
		ctx.Output.JSON(map[string]string{"error": "Experiment name is required"}, false, false)
		return
	}

	if len(req.Variants) < 2 {
		ctx.Output.SetStatus(400)
		ctx.Output.JSON(map[string]string{"error": "At least 2 variants are required"}, false, false)
		return
	}

	if err := h.service.CreateExperiment(req.Name, req.Variants); err != nil {
		logger.Errorf("Failed to create experiment: %v", err)
		ctx.Output.SetStatus(400)
		ctx.Output.JSON(map[string]string{"error": err.Error()}, false, false)
		return
	}

	logger.Infof("Created experiment: %s", req.Name)
	ctx.Output.SetStatus(201)
	ctx.Output.JSON(map[string]interface{}{
		"message": "Experiment created",
		"experiment": map[string]interface{}{
			"name":     req.Name,
			"variants": req.Variants,
			"active":   true,
		},
	}, false, false)
}

func (h *ABTestingHandler) GetVariant(ctx *context.Context) {
	experimentName := ctx.Input.Param(":experiment")
	if experimentName == "" {
		ctx.Output.SetStatus(400)
		ctx.Output.JSON(map[string]string{"error": "Experiment name is required"}, false, false)
		return
	}

	userID := ctx.Input.Header("X-User-ID")
	if userID == "" {
		ctx.Output.SetStatus(400)
		ctx.Output.JSON(map[string]string{"error": "User ID is required"}, false, false)
		return
	}

	variant, err := h.service.GetVariant(experimentName, userID)
	if err != nil {
		logger.Errorf("Failed to get variant: %v", err)
		ctx.Output.SetStatus(404)
		ctx.Output.JSON(map[string]string{"error": err.Error()}, false, false)
		return
	}

	ctx.Output.JSON(map[string]string{
		"experiment": experimentName,
		"variant":    variant,
	}, false, false)
}

func (h *ABTestingHandler) ListExperiments(ctx *context.Context) {
	experiments := h.service.ListExperiments()
	
	ctx.Output.JSON(map[string]interface{}{
		"experiments": experiments,
	}, false, false)
}

func (h *ABTestingHandler) StopExperiment(ctx *context.Context) {
	experimentName := ctx.Input.Param(":experiment")
	if experimentName == "" {
		ctx.Output.SetStatus(400)
		ctx.Output.JSON(map[string]string{"error": "Experiment name is required"}, false, false)
		return
	}

	if err := h.service.StopExperiment(experimentName); err != nil {
		logger.Errorf("Failed to stop experiment: %v", err)
		ctx.Output.SetStatus(404)
		ctx.Output.JSON(map[string]string{"error": err.Error()}, false, false)
		return
	}

	logger.Infof("Stopped experiment: %s", experimentName)
	ctx.Output.JSON(map[string]string{
		"message": "Experiment stopped",
	}, false, false)
}
