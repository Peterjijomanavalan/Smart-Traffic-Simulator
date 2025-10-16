let selectedRoad = null;
let selectedVehicle = null;

function selectRoad(road) {
    selectedRoad = road;
    console.log("Selected road:", road);
}

function selectVehicle(type) {
    selectedVehicle = type;
    console.log("Selected vehicle:", type);
}

function activateEmergency() {
    if (!selectedRoad || !selectedVehicle) {
        alert("Select both road and vehicle type.");
        return;
    }

    ['A','B','C','D'].forEach(r => {
        const roadDiv = document.getElementById('road' + r);
        const signal = roadDiv.querySelector('.signal');
        if (r === selectedRoad) {
            roadDiv.classList.add('green');
            roadDiv.classList.remove('red');
            signal.className = 'signal green';
        } else {
            roadDiv.classList.add('red');
            roadDiv.classList.remove('green');
            signal.className = 'signal red';
        }
    });

    alert(`${selectedVehicle} emergency activated — Road ${selectedRoad} GREEN, others RED.`);
}
