const { randomUUID } = require('crypto');
const Docker = require('dockerode');
const docker = new Docker();
const fs = require('fs-extra');
const tar = require('tar-stream');
const path = require('path');
const { CONTAINER_NAME_PREFIX, MAX_CONTAINER_SIZE } = require('./constants');

async function createVolume(name) {
  try {
    const volume = await docker.createVolume({
      Name: name,
      Driver: 'local',
    });
    console.log(`Volumen ${name} creado`);
    return volume;
  } catch (error) {
    console.error('Error al crear volumen:', error);
  }
}

async function createContainer(basePath) {
  const name = randomUUID();
  const volumeName = `${name}-volume`;

  try {
    const containerDir = path.join(basePath, name);
    await fs.ensureDir(containerDir);

    await createVolume(volumeName);

    const container = await docker.createContainer({
      Image: 'alpine',
      name: `${CONTAINER_NAME_PREFIX}${name}`,
      HostConfig: {
        Mounts: [
          {
            Target: '/app/storage',
            Source: volumeName,
            Type: 'volume',
          },
        ],
      },
      Cmd: ['tail', '-f', '/dev/null'],
    });

    await container.start();
    console.log(
      `Contenedor ${name} creado y en ejecución con volumen ${volumeName}`
    );
    return container.id;
  } catch (error) {
    console.error('Error al crear el contenedor:', error);
  }
}

async function listContainers() {
  const containers = await docker.listContainers();

  const myDriveOsContainers = containers.filter((container) =>
    container.Names[0].startsWith(`/${CONTAINER_NAME_PREFIX}`)
  );

  if (myDriveOsContainers.length === 0) {
    await createContainer(path.join(__dirname));
  }

  return myDriveOsContainers.map((container) => container.Id);
}

async function findOrCreateContainer(filePath) {
  const containers = await listContainers();
  const fileSize = fs.statSync(filePath).size;

  if(fileSize > MAX_CONTAINER_SIZE) {
    throw new Error('El archivo es demasiado grande para ser almacenado en algún contenedor.');
  }

  let containerId = containers[0];
  for (const id of containers) {
    const usedSpace = await getStorageSize(id);
    if (usedSpace + fileSize <= MAX_CONTAINER_SIZE) {
      containerId = id;
      break;
    }
  }

  const usedSpace = await getStorageSize(containerId);
  if (usedSpace + fileSize > MAX_CONTAINER_SIZE) {
    console.log(
      'Espacio insuficiente en contenedores existentes. Creando un nuevo contenedor...'
    );
    containerId = await createContainer(path.join(__dirname));
  }

  return containerId;
}

async function saveFileInContainer(containerId, filePath) {
  const fileName = path.basename(filePath);
  const container = docker.getContainer(containerId);

  try {
    const pack = tar.pack(); 
    pack.entry({ name: fileName }, fs.readFileSync(filePath));
    pack.finalize();

    await container.putArchive(pack, { path: '/app/storage' });
    console.log(`Archivo ${fileName} guardado en el contenedor ${containerId}`);
  } catch (error) {
    console.error('Error al guardar el archivo en el contenedor:', error);
  }
}

async function uploadFileWithCheck(filePath) {
    const containerId = await findOrCreateContainer(filePath);
    await saveFileInContainer(containerId, filePath);
}

async function getStorageSize(containerId) {
  const container = docker.getContainer(containerId);

  try {
    const exec = await container.exec({
      Cmd: ['du', '-sh', '/app/storage'],
      AttachStdout: true,
      AttachStderr: false,
    });

    const stream = await exec.start();

    let output = '';
    stream.on('data', (chunk) => {
      output += chunk.toString();
    });

    return new Promise((resolve, reject) => {
      stream.on('end', () => {
        const size = cleanOutput(output.split('\t')[0]);
        const sizeInBytes = parseSize(size);
        console.log(`Tamaño actual del contenedor ${containerId}: ${sizeInBytes} bytes`);
        resolve(sizeInBytes);
      });

      stream.on('error', (err) => {
        reject('Error al obtener el tamaño: ' + err);
      });
    });
  } catch (error) {
    console.error('Error al ejecutar el comando dentro del contenedor:', error);
  }
}
function cleanOutput(output) {
  return output.replace(/[^\x20-\x7E]/g, '').trim();
}
function parseSize(size) {
  const units = { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 };
  
  const match = size.match(/^([\d.]+)([KMGT]?)$/i);
  if (!match) throw new Error(`Formato desconocido de tamaño: ${size}`);

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase(); 

  return unit ? value * (units[unit] || 1) : value;
}

async function getContainerDiskUsage() {
  try {
    const containers = await listContainers(); 
    const containerDiskInfo = [];

    for (const id of containers) {
      const usedSpace = await getStorageSize(id); 
      const availableSpace = MAX_CONTAINER_SIZE - usedSpace; 

      containerDiskInfo.push({
        id,
        name: `${CONTAINER_NAME_PREFIX}${id}`, 
        usedSpace, 
        availableSpace, 
      });
    }

    return containerDiskInfo;
  } catch (error) {
    console.error('Error al obtener el uso del disco de los contenedores:', error);
    return [];
  }
}

module.exports = {
  uploadFileWithCheck,
  createContainer,
  listContainers,
  saveFileInContainer,
  getContainerDiskUsage
};
