document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts
    const cpuChart = initChart('cpuChart', 'CPU Usage (cores)');
    const memoryChart = initChart('memoryChart', 'Memory Usage (bytes)');
    const podCpuChart = initChart('podCpuChart', 'Pod CPU Usage (cores)');
    const podMemoryChart = initChart('podMemoryChart', 'Pod Memory Usage (bytes)');
    
    // UI elements
    const timeRangeSelect = document.getElementById('timeRange');
    const namespaceInput = document.getElementById('namespace');
    const nodesView = document.getElementById('nodesView');
    const podsView = document.getElementById('podsView');
    const namespaceSelector = document.getElementById('namespaceSelector');
    const nodesTable = document.querySelector('#nodesTable tbody');
    const podsTable = document.querySelector('#podsTable tbody');
    
    // Navigation
    document.querySelectorAll('[data-view]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const view = this.getAttribute('data-view');
            
            // Update active nav link
            document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
            this.classList.add('active');
            
            // Show/hide views
            if (view === 'nodes') {
                nodesView.style.display = 'block';
                podsView.style.display = 'none';
                namespaceSelector.style.display = 'none';
                loadNodesData();
            } else {
                nodesView.style.display = 'none';
                podsView.style.display = 'block';
                namespaceSelector.style.display = 'block';
                loadPodsData();
            }
        });
    });
    
    // Time range change handler
    timeRangeSelect.addEventListener('change', function() {
        if (nodesView.style.display !== 'none') {
            loadNodesData();
        } else {
            loadPodsData();
        }
    });
    
    // Namespace change handler
    namespaceInput.addEventListener('change', function() {
        loadPodsData();
    });
    
    // Initial load
    loadNodesData();
    
    // Functions
    function initChart(canvasId, label) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: label,
                    data: [],
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
    
    function updateChart(chart, labels, data) {
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.update();
    }
    
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    function loadNodesData() {
        const timeRange = timeRangeSelect.value;
        
        fetch(`/api/metrics/nodes?range=${timeRange}`)
            .then(response => response.json())
            .then(data => {
                // Process CPU data
                const cpuData = data.cpu_usage.result || [];
                const cpuLabels = cpuData.map(item => item.metric.instance);
                const cpuValues = cpuData.map(item => parseFloat(item.value[1]));
                
                updateChart(cpuChart, cpuLabels, cpuValues);
                
                // Process Memory data
                const memoryData = data.memory_usage.result || [];
                const memoryLabels = memoryData.map(item => item.metric.instance);
                const memoryValues = memoryData.map(item => parseFloat(item.value[1]));
                
                updateChart(memoryChart, memoryLabels, memoryValues);
                
                // Process Pod count data
                const podCountData = data.pod_count.result || [];
                
                // Update table
                nodesTable.innerHTML = '';
                
                // Combine all metrics for table
                cpuData.forEach(cpuItem => {
                    const instance = cpuItem.metric.instance;
                    const cpuUsage = parseFloat(cpuItem.value[1]).toFixed(2);
                    
                    // Find memory for this instance
                    const memoryItem = memoryData.find(m => m.metric.instance === instance);
                    const memoryUsage = memoryItem ? formatBytes(parseFloat(memoryItem.value[1])) : 'N/A';
                    
                    // Find pod count for this instance
                    const podCountItem = podCountData.find(p => p.metric.node === instance);
                    const podCount = podCountItem ? podCountItem.value[1] : 'N/A';
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${instance}</td>
                        <td>${cpuUsage}</td>
                        <td>${memoryUsage}</td>
                        <td>${podCount}</td>
                    `;
                    nodesTable.appendChild(row);
                });
            })
            .catch(error => {
                console.error('Error loading nodes data:', error);
                alert('Failed to load nodes data. See console for details.');
            });
    }
    
    function loadPodsData() {
        const timeRange = timeRangeSelect.value;
        const namespace = namespaceInput.value || 'default';
        
        fetch(`/api/metrics/pods?range=${timeRange}&namespace=${namespace}`)
            .then(response => response.json())
            .then(data => {
                // Process CPU data
                const cpuData = data.cpu.result || [];
                const cpuLabels = cpuData.map(item => item.metric.pod);
                const cpuValues = cpuData.map(item => parseFloat(item.value[1]));
                
                updateChart(podCpuChart, cpuLabels, cpuValues);
                
                // Process Memory data
                const memoryData = data.memory.result || [];
                const memoryLabels = memoryData.map(item => item.metric.pod);
                const memoryValues = memoryData.map(item => parseFloat(item.value[1]));
                
                updateChart(podMemoryChart, memoryLabels, memoryValues);
                
                // Process Status data
                const statusData = data.status.result || [];
                
                // Update table
                podsTable.innerHTML = '';
                
                // Combine all metrics for table
                cpuData.forEach(cpuItem => {
                    const pod = cpuItem.metric.pod;
                    const cpuUsage = parseFloat(cpuItem.value[1]).toFixed(4);
                    
                    // Find memory for this pod
                    const memoryItem = memoryData.find(m => m.metric.pod === pod);
                    const memoryUsage = memoryItem ? formatBytes(parseFloat(memoryItem.value[1])) : 'N/A';
                    
                    // Find status for this pod
                    const statusItem = statusData.find(s => s.metric.pod === pod);
                    const status = statusItem ? statusItem.metric.phase : 'N/A';
                    
                    let statusClass = '';
                    switch(status) {
                        case 'Running': statusClass = 'text-success'; break;
                        case 'Pending': statusClass = 'text-warning'; break;
                        case 'Failed': statusClass = 'text-danger'; break;
                        default: statusClass = 'text-secondary';
                    }
                    
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${pod}</td>
                        <td>${cpuUsage}</td>
                        <td>${memoryUsage}</td>
                        <td class="${statusClass}">${status}</td>
                    `;
                    podsTable.appendChild(row);
                });
            })
            .catch(error => {
                console.error('Error loading pods data:', error);
                alert('Failed to load pods data. See console for details.');
            });
    }
});
