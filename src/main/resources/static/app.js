// app.js - plain JS SPA with SSE + Chart.js + export features
document.addEventListener('DOMContentLoaded', () => {
    // Routing / nav
    const navDashboard = document.getElementById('nav-dashboard');
    const navAnalytics = document.getElementById('nav-analytics');
    const pageDashboard = document.getElementById('page-dashboard');
    const pageAnalytics = document.getElementById('page-analytics');

    function showPage(page) {
        pageDashboard.classList.remove('visible');
        pageAnalytics.classList.remove('visible');
        page.classList.add('visible');
        navDashboard.classList.toggle('active', page === pageDashboard);
        navAnalytics.classList.toggle('active', page === pageAnalytics);
    }
    navDashboard.addEventListener('click', () => showPage(pageDashboard));
    navAnalytics.addEventListener('click', () => showPage(pageAnalytics));

    // Controls
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const startSimLarge = document.getElementById('startSimLarge');
    const stopSimLarge = document.getElementById('stopSimLarge');
    const speedBtns = document.querySelectorAll('.speed');
    const simStatus = document.getElementById('simStatus');
    const simCycles = document.getElementById('simCycles');
    const simTime = document.getElementById('simTime');

    async function post(path) {
        try {
            const res = await fetch(path, { method: 'POST' });
            return res;
        } catch (e) {
            console.error('Network error', e);
        }
    }

    [startBtn, startSimLarge].forEach(b => b.addEventListener('click', async () => {
        await post('/api/start');
        simStatus.textContent = 'Running';
    }));
    [stopBtn, stopSimLarge].forEach(b => b.addEventListener('click', async () => {
        await post('/api/stop');
        simStatus.textContent = 'Stopped';
    }));

    speedBtns.forEach(s => {
        s.addEventListener('click', () => {
            speedBtns.forEach(x => x.classList.remove('active'));
            s.classList.add('active');
            // optional backend support: /api/speed?value=...
            fetch('/api/speed?value=' + s.dataset.speed).catch(() => {});
        });
    });

    // Chart.js setup for throughput over time
    const ctx = document.getElementById('throughputChart').getContext('2d');
    const throughputData = { labels: [], datasets: [
            { label: 'Road A', data: [], borderWidth: 2, tension: 0.35 },
            { label: 'Road B', data: [], borderWidth: 2, tension: 0.35 },
            { label: 'Road C', data: [], borderWidth: 2, tension: 0.35 },
            { label: 'Road D', data: [], borderWidth: 2, tension: 0.35 }
        ]};
    const throughputChart = new Chart(ctx, {
        type: 'line',
        data: throughputData,
        options: {
            animation: false,
            scales: { x: { display: true }, y: { beginAtZero: true } }
        }
    });

    // SSE connection
    let evt;
    function startSSE() {
        try {
            evt = new EventSource('/api/sse');
            evt.addEventListener('update', e => {
                try {
                    const payload = JSON.parse(e.data);
                    handlePayload(payload);
                } catch (err) {
                    console.error('SSE parse error', err);
                }
            });
            evt.onerror = (e) => {
                console.warn('SSE error', e);
                // try reconnecting after a pause
                evt.close();
                setTimeout(startSSE, 2000);
            };
        } catch (err) {
            console.error('SSE start failed', err);
        }
    }
    startSSE();

    function handlePayload(payload) {
        const data = payload.data || payload;
        // update roads & summary
        let totalV = 0, totalQ = 0;
        Object.keys(data).forEach(k => {
            const r = data[k];
            const el = document.getElementById('road' + k);
            if (!el) return;
            const light = el.querySelector('.light');
            light.textContent = r.light;
            light.setAttribute('data-state', r.light === 'GREEN' ? 'GREEN' : 'RED');
            el.querySelector('.stats').innerHTML = `<div>Vehicles: ${r.vehicles}</div><div>Queue: ${r.queue}</div>`;
            totalV += r.vehicles; totalQ += r.queue;
        });
        document.getElementById('summary').innerHTML = `Total Vehicles: ${totalV} &nbsp; Total Queue: ${totalQ}`;
        document.getElementById('raw').textContent = JSON.stringify(data, null, 2);
        simCycles.textContent = payload.cycles || simCycles.textContent;
        simTime.textContent = new Date().toLocaleTimeString();

        // update chart (push new datapoint)
        const ts = new Date().toLocaleTimeString();
        // push labels
        throughputData.labels.push(ts);
        if (throughputData.labels.length > 20) throughputData.labels.shift();
        // push each road value
        ['A','B','C','D'].forEach((k, idx) => {
            const v = data[k] ? data[k].vehicles : 0;
            throughputData.datasets[idx].data.push(v);
            if (throughputData.datasets[idx].data.length > 20) throughputData.datasets[idx].data.shift();
        });
        throughputChart.update();

        // populate analytics metrics
        document.getElementById('metric-eff').textContent = Math.max(60, 80 + Math.round((Math.random() - 0.5) * 10)) + '%';
        document.getElementById('metric-wait').textContent = (20 + Math.round(Math.random() * 40)) + 's';
        document.getElementById('metric-throughput').textContent = Math.round(totalV * 2);
        document.getElementById('metric-em').textContent = Math.round(Math.random() * 5);

        // detailed table
        const tbody = document.getElementById('detailedRows'); tbody.innerHTML = '';
        Object.keys(data).forEach(k => {
            const r = data[k];
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>Road ${k}</td><td>${Math.round(10 + Math.random() * 40)}s</td><td>${Math.round(60 + Math.random() * 30)}%</td><td>${r.queue}</td><td>${r.vehicles}</td>`;
            tbody.appendChild(tr);
        });
    }

    // initial fetch snapshot
    fetch('/api/snapshot').then(r => r.json()).then(snap => {
        handlePayload({ cycles: 0, data: snap });
    }).catch(() => {});

    // Exports
    document.getElementById('exportCsv').addEventListener('click', () => {
        // generate CSV from current detailed rows
        const rows = [];
        const headers = ['Road', 'Avg Wait', 'Efficiency', 'Queue', 'Total Vehicles'];
        rows.push(headers.join(','));
        document.querySelectorAll('#detailedRows tr').forEach(tr => {
            const cols = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.replace(',', ''));
            rows.push(cols.join(','));
        });
        const csv = rows.join('\\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'traffic_report.csv'; a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('exportPdf').addEventListener('click', async () => {
        // simple PDF export: chart + metrics text
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape' });
        pdf.setFontSize(14);
        pdf.text('Smart Traffic Simulator Report', 10, 10);
        pdf.setFontSize(10);
        pdf.text(`System Efficiency: ${document.getElementById('metric-eff').textContent}`, 10, 20);
        pdf.text(`Avg Wait Time: ${document.getElementById('metric-wait').textContent}`, 10, 28);
        pdf.text(`Total Throughput: ${document.getElementById('metric-throughput').textContent}`, 10, 36);

        // draw chart image into PDF
        const chartCanvas = document.getElementById('throughputChart');
        const dataUrl = chartCanvas.toDataURL('image/png', 1.0);
        pdf.addImage(dataUrl, 'PNG', 10, 45, 260, 100);
        pdf.save('traffic_report.pdf');
    });

    // show default page
    showPage(pageDashboard);
});
