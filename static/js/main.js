document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // PAGE DETECTOR
    // -------------------------------------------------------------------------
    const isIndexPage = document.getElementById('drop-zone') !== null;
    const isHistoryPage = document.getElementById('history-table-body') !== null;
    const isDashboardPage = document.getElementById('pestDistributionChart') !== null;

    // -------------------------------------------------------------------------
    // PAGE 1: DIAGNOSTICS (INDEX PAGE)
    // -------------------------------------------------------------------------
    if (isIndexPage) {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const analyzeBtn = document.getElementById('analyze-btn');
        const selectBtn = dropZone.querySelector('.select-btn');
        const previewContainer = document.getElementById('preview-container');
        const imagePreview = document.getElementById('image-preview');
        const removeBtn = document.getElementById('remove-btn');
        const uploadForm = document.getElementById('upload-form');
        const dropZoneContent = dropZone.querySelector('.drop-zone-content');

        const resultsPlaceholder = document.getElementById('results-placeholder');
        const analysisLoader = document.getElementById('analysis-loader');
        const loaderStatus = analysisLoader.querySelector('.loader-status');
        const analysisProgressBar = document.getElementById('analysis-progress-bar');
        const resultsDisplay = document.getElementById('results-display');
        const resetBtn = document.getElementById('reset-btn');

        // Drag & Drop event listeners
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                fileInput.files = files;
                handleFileSelect(files[0]);
            }
        });

        // Click browse button
        selectBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFileSelect(fileInput.files[0]);
            }
        });

        // Remove image action
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetUploadForm();
        });

        function handleFileSelect(file) {
            if (!file.type.startsWith('image/')) {
                alert('Please upload an image file (PNG, JPG, JPEG, WEBP).');
                resetUploadForm();
                return;
            }
            
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onloadend = () => {
                imagePreview.src = reader.result;
                dropZoneContent.classList.add('hidden');
                previewContainer.classList.remove('hidden');
                analyzeBtn.classList.remove('disabled');
                analyzeBtn.removeAttribute('disabled');
            };
        }

        function resetUploadForm() {
            fileInput.value = '';
            imagePreview.src = '#';
            previewContainer.classList.add('hidden');
            dropZoneContent.classList.remove('hidden');
            analyzeBtn.classList.add('disabled');
            analyzeBtn.setAttribute('disabled', 'true');
        }

        // Form Submit (AJAX inference)
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (fileInput.files.length === 0) return;

            const formData = new FormData();
            formData.append('image', fileInput.files[0]);

            // Hide placeholder, show loader
            resultsPlaceholder.classList.add('hidden');
            resultsDisplay.classList.add('hidden');
            analysisLoader.classList.remove('hidden');

            // Simulate progress bar movement
            let progress = 0;
            const statusMessages = [
                'Pre-processing image matrix...',
                'Resizing to 224x224 input tensors...',
                'Running MobileNetV2 feature extraction...',
                'Classifying probability distributions...',
                'Executing OpenCV HSV leaf color thresholding...',
                'Calculating severity index...',
                'Finalizing report recommendations...'
            ];

            const interval = setInterval(() => {
                if (progress < 90) {
                    progress += Math.floor(Math.random() * 15) + 5;
                    if (progress > 90) progress = 90;
                    
                    analysisProgressBar.style.width = `${progress}%`;
                    const msgIdx = Math.floor((progress / 90) * statusMessages.length);
                    loaderStatus.textContent = statusMessages[Math.min(msgIdx, statusMessages.length - 1)];
                }
            }, 300);

            // Make API Call
            fetch('/api/diagnose', {
                method: 'POST',
                body: formData
            })
            .then(res => {
                if (!res.ok) {
                    return res.json().then(err => { throw new Error(err.error || 'Server error'); });
                }
                return res.json();
            })
            .then(data => {
                clearInterval(interval);
                analysisProgressBar.style.width = '100%';
                loaderStatus.textContent = 'Report compiled!';

                setTimeout(() => {
                    analysisLoader.classList.add('hidden');
                    resultsDisplay.classList.remove('hidden');
                    populateResults(data);
                }, 500);
            })
            .catch(error => {
                clearInterval(interval);
                analysisLoader.classList.add('hidden');
                resultsPlaceholder.classList.remove('hidden');
                alert(`Error: ${error.message}`);
                console.error(error);
            });
        });

        function populateResults(data) {
            document.getElementById('result-pest-name').textContent = data.predicted_class;
            
            // Set Confidence Badge
            const confText = `${data.confidence.toFixed(1)}% Match`;
            document.getElementById('result-confidence-badge').innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${confText}`;
            document.getElementById('metric-conf-pct').textContent = `${data.confidence.toFixed(1)}%`;
            document.getElementById('metric-bar-fill').style.width = `${data.confidence}%`;

            // Set Severity Badge
            const sevBadge = document.getElementById('result-severity-badge');
            sevBadge.textContent = `${data.severity} Severity`;
            
            // Classify severity badges colors
            sevBadge.className = 'badge'; // Reset classes
            if (data.severity === 'High') {
                sevBadge.classList.add('badge-high');
            } else if (data.severity === 'Medium') {
                sevBadge.classList.add('badge-medium');
            } else if (data.severity === 'Low') {
                sevBadge.classList.add('badge-low');
            } else {
                sevBadge.classList.add('badge-na');
                sevBadge.textContent = 'Severity: N/A';
            }

            // Fill Symptoms and causes
            document.getElementById('result-symptoms').textContent = data.symptoms;
            document.getElementById('result-causes').textContent = data.causes;
            
            // Fill recommendations
            document.getElementById('result-chemical').textContent = data.pesticide;
            document.getElementById('result-organic').textContent = data.organic_alternative;
        }

        // Reset Button
        resetBtn.addEventListener('click', () => {
            resultsDisplay.classList.add('hidden');
            resultsPlaceholder.classList.remove('hidden');
            resetUploadForm();
        });
    }

    // -------------------------------------------------------------------------
    // PAGE 2: LOG HISTORY PAGE
    // -------------------------------------------------------------------------
    if (isHistoryPage) {
        let historyData = [];
        const tableBody = document.getElementById('history-table-body');
        const emptyState = document.getElementById('history-empty');
        const searchInput = document.getElementById('search-input');
        const filterPest = document.getElementById('filter-pest');
        const filterSeverity = document.getElementById('filter-severity');

        // Modal Elements
        const detailsModal = document.getElementById('details-modal');
        const modalClose = document.getElementById('modal-close');
        const modalOverlay = detailsModal.querySelector('.modal-overlay');

        // Fetch History
        function loadHistory() {
            fetch('/api/history')
                .then(res => res.json())
                .then(data => {
                    historyData = data;
                    renderHistoryTable(historyData);
                })
                .catch(err => {
                    console.error('Error fetching history:', err);
                    tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-red">Failed to load history from database.</td></tr>';
                });
        }

        function renderHistoryTable(data) {
            if (data.length === 0) {
                tableBody.innerHTML = '';
                emptyState.classList.remove('hidden');
                document.querySelector('.table-responsive').classList.add('hidden');
                return;
            }

            emptyState.classList.add('hidden');
            document.querySelector('.table-responsive').classList.remove('hidden');

            tableBody.innerHTML = data.map(record => {
                // Determine severity badge markup
                let sevClass = 'badge-na';
                if (record.severity === 'High') sevClass = 'badge-high';
                else if (record.severity === 'Medium') sevClass = 'badge-medium';
                else if (record.severity === 'Low') sevClass = 'badge-low';

                // Handle seeded vs uploaded images path
                const imgSrc = record.filename.startsWith('seed_') 
                    ? 'https://placehold.co/100x100/1e261e/40a045?text=Tobacco+Leaf' 
                    : `/static/uploads/${record.filename}`;

                return `
                    <tr data-id="${record.id}">
                        <td>
                            <img src="${imgSrc}" class="table-thumb" alt="leaf thumb" onerror="this.src='https://placehold.co/100x100/1e261e/40a045?text=Leaf'">
                        </td>
                        <td class="date-col">${record.created_at}</td>
                        <td class="class-col"><strong>${record.predicted_class}</strong></td>
                        <td>${record.confidence}%</td>
                        <td><span class="badge ${sevClass}">${record.severity}</span></td>
                        <td class="truncate-col">${record.pesticide}</td>
                        <td class="text-right actions-cell">
                            <button class="btn-action view-btn" data-id="${record.id}" title="View Details">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button class="btn-action delete-btn" data-id="${record.id}" title="Delete Record">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            // Attach event listeners to buttons
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.currentTarget.getAttribute('data-id'));
                    openDetailsModal(id);
                });
            });

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.currentTarget.getAttribute('data-id'));
                    deleteRecord(id);
                });
            });
        }

        // Live Filtering
        function applyFilters() {
            const query = searchInput.value.toLowerCase();
            const selectedPest = filterPest.value;
            const selectedSeverity = filterSeverity.value;

            const filtered = historyData.filter(record => {
                const matchesSearch = record.predicted_class.toLowerCase().includes(query) || 
                                     record.pesticide.toLowerCase().includes(query) ||
                                     record.symptoms.toLowerCase().includes(query);
                
                const matchesPest = selectedPest === "" || record.predicted_class === selectedPest;
                const matchesSeverity = selectedSeverity === "" || record.severity === selectedSeverity;

                return matchesSearch && matchesPest && matchesSeverity;
            });

            renderHistoryTable(filtered);
        }

        searchInput.addEventListener('input', applyFilters);
        filterPest.addEventListener('change', applyFilters);
        filterSeverity.addEventListener('change', applyFilters);

        // Modal Functionality
        function openDetailsModal(id) {
            const record = historyData.find(r => r.id === id);
            if (!record) return;

            document.getElementById('modal-date').textContent = `Scanned on: ${record.created_at}`;
            document.getElementById('modal-pest-name').textContent = record.predicted_class;
            document.getElementById('modal-symptoms').textContent = record.symptoms;
            document.getElementById('modal-causes').textContent = record.causes;
            document.getElementById('modal-chemical').textContent = record.pesticide;
            document.getElementById('modal-organic').textContent = record.organic_alternative;
            
            // Set image preview
            const modalImg = document.getElementById('modal-image');
            modalImg.src = record.filename.startsWith('seed_') 
                ? 'https://placehold.co/400x300/1e261e/40a045?text=Tobacco+Leaf' 
                : `/static/uploads/${record.filename}`;

            // Confidence Badge
            document.getElementById('modal-confidence-badge').innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${record.confidence}% Match`;

            // Severity Badge
            const sevBadge = document.getElementById('modal-severity-badge');
            sevBadge.textContent = `${record.severity} Severity`;
            sevBadge.className = 'badge';
            if (record.severity === 'High') sevBadge.classList.add('badge-high');
            else if (record.severity === 'Medium') sevBadge.classList.add('badge-medium');
            else if (record.severity === 'Low') sevBadge.classList.add('badge-low');
            else {
                sevBadge.classList.add('badge-na');
                sevBadge.textContent = 'Severity: N/A';
            }

            detailsModal.classList.remove('hidden');
            document.body.classList.add('modal-open');
        }

        function closeModal() {
            detailsModal.classList.add('hidden');
            document.body.classList.remove('modal-open');
        }

        modalClose.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', closeModal);

        // Delete API request
        function deleteRecord(id) {
            if (confirm('Are you sure you want to permanently delete this diagnostic scan? This action cannot be undone.')) {
                fetch(`/api/delete/${id}`, { method: 'DELETE' })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            historyData = historyData.filter(r => r.id !== id);
                            applyFilters();
                        } else {
                            alert('Delete failed: ' + data.error);
                        }
                    })
                    .catch(err => {
                        console.error('Delete error:', err);
                        alert('Could not delete record.');
                    });
            }
        }

        // Initialize Load
        loadHistory();
    }

    // -------------------------------------------------------------------------
    // PAGE 3: ANALYTICS DASHBOARD PAGE
    // -------------------------------------------------------------------------
    if (isDashboardPage) {
        function loadDashboardData() {
            fetch('/api/statistics')
                .then(res => res.json())
                .then(stats => {
                    populateSummaryMetrics(stats);
                    renderPestChart(stats.pest_counts);
                    renderSeverityChart(stats.severity_counts);
                    renderTrendChart(stats.trend_data);
                })
                .catch(err => {
                    console.error('Error loading dashboard stats:', err);
                });
        }

        function populateSummaryMetrics(stats) {
            document.getElementById('stat-total-scans').textContent = stats.total_diagnosed;
            document.getElementById('stat-infestations').textContent = stats.infestation_count;
            document.getElementById('stat-healthy').textContent = stats.healthy_count;
            document.getElementById('stat-confidence').textContent = `${stats.avg_confidence}%`;
        }

        function renderPestChart(pestCounts) {
            const ctx = document.getElementById('pestDistributionChart').getContext('2d');
            
            const labels = Object.keys(pestCounts);
            const data = Object.values(pestCounts);
            
            // Modern Green themed colors
            const backgroundColors = [
                'rgba(40, 167, 69, 0.75)',   // Healthy
                'rgba(220, 53, 69, 0.75)',    // Budworm
                'rgba(255, 193, 7, 0.75)',    // Aphids
                'rgba(23, 162, 184, 0.75)',   // Whiteflies
                'rgba(111, 66, 193, 0.75)',   // Cutworms
                'rgba(253, 126, 20, 0.75)'    // Thrips
            ];
            
            const borderColors = [
                '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#fd7e14'
            ];

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: backgroundColors.slice(0, labels.length),
                        borderColor: borderColors.slice(0, labels.length),
                        borderWidth: 1.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                color: '#d1d5db',
                                font: { family: 'Outfit', size: 12 }
                            }
                        }
                    }
                }
            });
        }

        function renderSeverityChart(severityCounts) {
            const ctx = document.getElementById('severityBreakdownChart').getContext('2d');
            
            const labels = ['Low', 'Medium', 'High', 'N/A'];
            const data = [
                severityCounts.Low || 0,
                severityCounts.Medium || 0,
                severityCounts.High || 0,
                severityCounts['N/A'] || 0
            ];

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Incidents Count',
                        data: data,
                        backgroundColor: [
                            'rgba(40, 167, 69, 0.6)',  // Low - green
                            'rgba(255, 193, 7, 0.6)',  // Medium - yellow
                            'rgba(220, 53, 69, 0.6)',  // High - red
                            'rgba(108, 117, 125, 0.6)' // N/A - gray
                        ],
                        borderColor: [
                            '#28a745', '#ffc107', '#dc3545', '#6c757d'
                        ],
                        borderWidth: 1.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { color: '#9ca3af', font: { family: 'Outfit' } }
                        },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#9ca3af', stepSize: 1, font: { family: 'Outfit' } }
                        }
                    }
                }
            });
        }

        function renderTrendChart(trendData) {
            const ctx = document.getElementById('activityTrendChart').getContext('2d');
            
            const labels = trendData.map(d => d.date);
            const data = trendData.map(d => d.count);

            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Scans Done',
                        data: data,
                        borderColor: '#39c656',
                        backgroundColor: 'rgba(57, 198, 86, 0.1)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: '#39c656'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#d1d5db',
                                font: { family: 'Outfit' }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255, 255, 255, 0.03)' },
                            ticks: { color: '#9ca3af', font: { family: 'Outfit' } }
                        },
                        y: {
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { color: '#9ca3af', stepSize: 1, font: { family: 'Outfit' } }
                        }
                    }
                }
            });
        }

        // Initialize Load
        loadDashboardData();
    }
});
