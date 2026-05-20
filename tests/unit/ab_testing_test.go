package unit

import (
	"testing"
	"unified-id/internal/services"
)

func TestABTestingService_CreateExperiment(t *testing.T) {
	service := services.NewABTestingService()

	variants := []services.Variant{
		{Name: "control", Weight: 50},
		{Name: "variant_a", Weight: 50},
	}

	err := service.CreateExperiment("test_experiment", variants)
	if err != nil {
		t.Fatalf("Failed to create experiment: %v", err)
	}

	experiments := service.ListExperiments()
	if len(experiments) != 1 {
		t.Fatalf("Expected 1 experiment, got %d", len(experiments))
	}

	if experiments[0].Name != "test_experiment" {
		t.Errorf("Expected experiment name 'test_experiment', got '%s'", experiments[0].Name)
	}
}

func TestABTestingService_GetVariant(t *testing.T) {
	service := services.NewABTestingService()

	variants := []services.Variant{
		{Name: "control", Weight: 50},
		{Name: "variant_a", Weight: 50},
	}

	err := service.CreateExperiment("test_experiment", variants)
	if err != nil {
		t.Fatalf("Failed to create experiment: %v", err)
	}

	userID := "user123"
	variant, err := service.GetVariant("test_experiment", userID)
	if err != nil {
		t.Fatalf("Failed to get variant: %v", err)
	}

	if variant != "control" && variant != "variant_a" {
		t.Errorf("Expected variant to be 'control' or 'variant_a', got '%s'", variant)
	}

	variant2, err := service.GetVariant("test_experiment", userID)
	if err != nil {
		t.Fatalf("Failed to get variant second time: %v", err)
	}

	if variant != variant2 {
		t.Errorf("Expected consistent variant assignment, got '%s' and '%s'", variant, variant2)
	}
}

func TestABTestingService_InvalidWeight(t *testing.T) {
	service := services.NewABTestingService()

	variants := []services.Variant{
		{Name: "control", Weight: 60},
		{Name: "variant_a", Weight: 50},
	}

	err := service.CreateExperiment("test_experiment", variants)
	if err == nil {
		t.Fatal("Expected error for invalid weight, got nil")
	}
}

func TestABTestingService_StopExperiment(t *testing.T) {
	service := services.NewABTestingService()

	variants := []services.Variant{
		{Name: "control", Weight: 50},
		{Name: "variant_a", Weight: 50},
	}

	err := service.CreateExperiment("test_experiment", variants)
	if err != nil {
		t.Fatalf("Failed to create experiment: %v", err)
	}

	err = service.StopExperiment("test_experiment")
	if err != nil {
		t.Fatalf("Failed to stop experiment: %v", err)
	}

	variant, err := service.GetVariant("test_experiment", "user123")
	if err != nil {
		t.Fatalf("Failed to get variant: %v", err)
	}

	if variant != "control" {
		t.Errorf("Expected default variant 'control' after stopping experiment, got '%s'", variant)
	}
}
