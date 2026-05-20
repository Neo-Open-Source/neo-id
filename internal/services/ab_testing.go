package services

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"sync"
)

type Variant struct {
	Name   string
	Weight int
}

type Experiment struct {
	Name     string
	Variants []Variant
	Active   bool
}

type ABTestingService struct {
	experiments map[string]*Experiment
	mu          sync.RWMutex
}

func NewABTestingService() *ABTestingService {
	return &ABTestingService{
		experiments: make(map[string]*Experiment),
	}
}

func (s *ABTestingService) CreateExperiment(name string, variants []Variant) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.experiments[name]; exists {
		return fmt.Errorf("experiment %s already exists", name)
	}

	totalWeight := 0
	for _, v := range variants {
		totalWeight += v.Weight
	}

	if totalWeight != 100 {
		return fmt.Errorf("total weight must be 100, got %d", totalWeight)
	}

	s.experiments[name] = &Experiment{
		Name:     name,
		Variants: variants,
		Active:   true,
	}

	return nil
}

func (s *ABTestingService) GetVariant(experimentName, userID string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	exp, exists := s.experiments[experimentName]
	if !exists {
		return "", fmt.Errorf("experiment %s not found", experimentName)
	}

	if !exp.Active {
		return exp.Variants[0].Name, nil
	}

	hash := md5.Sum([]byte(experimentName + userID))
	hashStr := hex.EncodeToString(hash[:])
	
	hashInt := 0
	for i := 0; i < 8; i++ {
		hashInt = (hashInt << 4) | int(hashStr[i]&0xf)
	}
	
	bucket := hashInt % 100

	cumulative := 0
	for _, variant := range exp.Variants {
		cumulative += variant.Weight
		if bucket < cumulative {
			return variant.Name, nil
		}
	}

	return exp.Variants[len(exp.Variants)-1].Name, nil
}

func (s *ABTestingService) StopExperiment(name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	exp, exists := s.experiments[name]
	if !exists {
		return fmt.Errorf("experiment %s not found", name)
	}

	exp.Active = false
	return nil
}

func (s *ABTestingService) ListExperiments() []*Experiment {
	s.mu.RLock()
	defer s.mu.RUnlock()

	experiments := make([]*Experiment, 0, len(s.experiments))
	for _, exp := range s.experiments {
		experiments = append(experiments, exp)
	}

	return experiments
}

var globalABService *ABTestingService
var abOnce sync.Once

func GetABTestingService() *ABTestingService {
	abOnce.Do(func() {
		globalABService = NewABTestingService()
	})
	return globalABService
}
