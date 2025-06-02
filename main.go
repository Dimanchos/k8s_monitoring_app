// main.go
package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"
)

// Константы для конфигурации
const (
	defaultPrometheusURL = "http://192.168.1.121:30484"
	defaultTimeRange     = "1h"
)

var prometheusURL string

func init() {
	prometheusURL = os.Getenv("PROMETHEUS_URL")
	if prometheusURL == "" {
		prometheusURL = defaultPrometheusURL
	}
}

func main() {
	http.HandleFunc("/api/health", healthHandler)
	http.HandleFunc("/api/metrics/nodes", nodeMetricsHandler)
	http.HandleFunc("/api/metrics/pods", podMetricsHandler)
	http.Handle("/", http.FileServer(http.Dir("./static")))

	log.Println("Сервер запущен на порту :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	jsonResponse(w, map[string]string{"status": "работает"})
}

func nodeMetricsHandler(w http.ResponseWriter, r *http.Request) {
	timeRange := r.URL.Query().Get("range")
	if timeRange == "" {
		timeRange = defaultTimeRange
	}

	if q := r.URL.Query().Get("q"); q != "" {
		data, err := queryPrometheus(q, timeRange)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonResponse(w, data)
		return
	}

	queries := map[string]string{
		"cpu_usage":    "sum(rate(node_cpu_seconds_total{mode!=\"idle\"}[1m])) by (instance)",
		"memory_usage": "node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes",
		"pod_count":    "count(kube_pod_info) by (node)",
	}

	results := make(map[string]interface{})
	for name, query := range queries {
		data, err := queryPrometheus(query, timeRange)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		results[name] = data
	}

	jsonResponse(w, results)
}

func podMetricsHandler(w http.ResponseWriter, r *http.Request) {
	namespace := r.URL.Query().Get("namespace")
	if namespace == "" {
		namespace = "default"
	}
	timeRange := r.URL.Query().Get("range")
	if timeRange == "" {
		timeRange = defaultTimeRange
	}

	if q := r.URL.Query().Get("q"); q != "" {
		data, err := queryPrometheus(q, timeRange)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonResponse(w, data)
		return
	}

	queries := map[string]string{
		"cpu":    fmt.Sprintf("sum(rate(container_cpu_usage_seconds_total{namespace=\"%s\"}[1m])) by (pod)", namespace),
		"memory": fmt.Sprintf("sum(container_memory_working_set_bytes{namespace=\"%s\"}) by (pod)", namespace),
		"status": fmt.Sprintf("kube_pod_status_phase{namespace=\"%s\"}", namespace),
	}

	results := make(map[string]interface{})
	for name, query := range queries {
		data, err := queryPrometheus(query, timeRange)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		results[name] = data
	}

	jsonResponse(w, results)
}

func queryPrometheus(query string, timeRange string) (interface{}, error) {
	escapedQuery := url.QueryEscape(query)
	timestamp := time.Now().Add(-parseDuration(timeRange)).Format(time.RFC3339)
	fullURL := fmt.Sprintf("%s/api/v1/query?query=%s&time=%s", prometheusURL, escapedQuery, timestamp)

	resp, err := http.Get(fullURL)
	if err != nil {
		return nil, fmt.Errorf("ошибка запроса к Prometheus: %v", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("ошибка чтения ответа: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("ошибка парсинга JSON: %v\nТело ответа: %s", err, string(body))
	}

	return result["data"], nil
}

func parseDuration(s string) time.Duration {
	duration, err := time.ParseDuration(s)
	if err != nil {
		return time.Hour
	}
	return duration
}

func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
