window.onload = () => {
    const selectFileButton = document.getElementById('selectFileButton');
    const uploadFileButton = document.getElementById('uploadFileButton');
    let selectedFilePath = null;

    selectFileButton.addEventListener('click', async () => {
        selectedFilePath = await window.electronAPI.selectFile();
        if (selectedFilePath) {
            console.log('Archivo seleccionado:', selectedFilePath);
        } else {
            alert('No se seleccionó ningún archivo.');
        }
    });

    uploadFileButton.addEventListener('click', async () => {
        if (!selectedFilePath) {
            alert('Debes seleccionar un archivo.');
            return;
        }

        try {
            await window.electronAPI.uploadFile(selectedFilePath);
            alert('Archivo cargado exitosamente!');
        } catch (error) {
            console.error('Error al cargar el archivo:', error);
            alert(error.message);
        }
    });

    updateStorageInfo();
};

async function updateStorageInfo() {
    const containerList = document.getElementById('containerList');
    containerList.innerHTML = '<p>Cargando información de almacenamiento...</p>';

    try {
        const containers = await window.electronAPI.getContainerDiskUsage();

        if (!containers.length) {
            containerList.innerHTML = '<p>No hay contenedores disponibles.</p>';
            return;
        }

        containerList.innerHTML = '';
        containers.forEach(container => {
            const percentageUsed = ((container.usedSpace / (container.usedSpace + container.availableSpace)) * 100).toFixed(2);
            const containerElement = document.createElement('div');
            containerElement.classList.add('container-info');
            containerElement.innerHTML = `
                <h4>${container.name}</h4>
                <p>Espacio usado: ${(container.usedSpace / 1024 ** 2).toFixed(2)} MB</p>
                <p>Espacio disponible: ${(container.availableSpace / 1024 ** 2).toFixed(2)} MB</p>
                <div class="progress-bar">
                    <span style="width: ${percentageUsed}%; background-color: ${getBarColor(percentageUsed)};">
                        ${percentageUsed}%
                    </span>
                </div>
            `;
            containerList.appendChild(containerElement);
        });
    } catch (error) {
        console.error('Error al obtener la información de almacenamiento:', error);
        containerList.innerHTML = '<p>Error al cargar la información de almacenamiento.</p>';
    }
}

function getBarColor(percentage) {
    if (percentage > 80) return '#e74c3c'; 
    if (percentage > 50) return '#f1c40f'; 
    return '#4caf50'; 
}
