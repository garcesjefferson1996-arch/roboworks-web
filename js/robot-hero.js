// robot-hero.js
// Robot 3D interactivo para el HERO de RoboWorks

let scene, camera, renderer, robot, controls, mixer, clock;
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const container = document.getElementById("robot-hero");

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRobot);
} else {
    initRobot();
}

function initRobot() {
    if (!container) {
        console.error("No se encontró el contenedor #robot-hero");
        return;
    }

    // Esperar un momento para asegurar que el contenedor tenga dimensiones
    setTimeout(() => {
        try {
            setupThreeJS();
            loadRobotModel();
            setupEventListeners();
            animate();
        } catch (error) {
            console.error("Error inicializando el robot 3D:", error);
            showFallbackImage();
        }
    }, 100);
}

function setupThreeJS() {
    // 1. Escena
    scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0xf0f0f0, 2, 10);

    // 2. Cámara
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    
    // Posición de cámara diferente para móvil
    if (isMobile) {
        camera.position.set(0, 1.2, 3.5);
    } else {
        camera.position.set(0, 1.5, 3);
    }

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
    });
    
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limitar pixel ratio
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.appendChild(renderer.domElement);

    // 4. Luces
    setupLights();

    // 5. Controles
    setupControls();

    // 6. Clock para animaciones
    clock = new THREE.Clock();
}

function setupLights() {
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Luz direccional principal
    const mainLight = new THREE.DirectionalLight(0xffffff, 1);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    // Luz de relleno
    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.3);
    fillLight.position.set(-5, 5, 5);
    scene.add(fillLight);

    // Luz de acento
    const accentLight = new THREE.PointLight(0xffaa88, 0.5, 10);
    accentLight.position.set(2, 3, 2);
    scene.add(accentLight);
}

function setupControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    
    // Configuración para mejor experiencia
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8;
    
    // Límites de cámara
    controls.minDistance = 2;
    controls.maxDistance = 6;
    controls.minPolarAngle = Math.PI / 6; // 30 grados
    controls.maxPolarAngle = Math.PI / 2; // 90 grados
    
    // Sensibilidad diferente para móvil
    if (isMobile) {
        controls.rotateSpeed = 0.5;
        controls.zoomSpeed = 0.7;
        controls.autoRotate = false; // Desactivar auto-rotación en móvil por defecto
    }
}

function loadRobotModel() {
    const loader = new THREE.GLTFLoader();
    
    // Mostrar loader
    container.classList.add('loading');
    
    loader.load(
        'robot.glb', // Asegúrate de que la ruta sea correcta
        (gltf) => {
            robot = gltf.scene;
            
            // Ajustar escala según dispositivo
            const scale = isMobile ? 1.0 : 1.2;
            robot.scale.set(scale, scale, scale);
            
            // Posicionar
            robot.position.y = -0.5;
            
            // Configurar sombras
            robot.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    // Mejorar materiales
                    if (child.material) {
                        child.material.metalness = 0.1;
                        child.material.roughness = 0.8;
                    }
                }
            });
            
            scene.add(robot);
            container.classList.remove('loading');
            container.classList.add('loaded');
            
            // Activar auto-rotación después de cargar (solo en desktop)
            if (!isMobile) {
                setTimeout(() => {
                    controls.autoRotate = true;
                }, 1000);
            }
            
            console.log('✅ Robot 3D cargado correctamente');
        },
        // Progreso de carga
        (xhr) => {
            const percentLoaded = (xhr.loaded / xhr.total) * 100;
            console.log(`📦 Cargando robot: ${percentLoaded.toFixed(0)}%`);
        },
        // Error
        (error) => {
            console.error('❌ Error cargando el robot:', error);
            container.classList.remove('loading');
            showFallbackImage();
        }
    );
}

function setupEventListeners() {
    // Redimensionar ventana
    window.addEventListener('resize', onWindowResize);
    
    // Pausar auto-rotación al interactuar
    renderer.domElement.addEventListener('mousedown', () => {
        controls.autoRotate = false;
    });
    
    renderer.domElement.addEventListener('touchstart', () => {
        controls.autoRotate = false;
    });
    
    // Reanudar auto-rotación después de un tiempo (solo desktop)
    if (!isMobile) {
        let idleTimer;
        
        const resetAutoRotate = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                if (!controls.autoRotate) {
                    controls.autoRotate = true;
                }
            }, 3000); // 3 segundos de inactividad
        };
        
        renderer.domElement.addEventListener('mouseup', resetAutoRotate);
        renderer.domElement.addEventListener('touchend', resetAutoRotate);
    }
}

function onWindowResize() {
    if (!container || !camera || !renderer) return;
    
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    if (!scene || !camera || !renderer) return;
    
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    if (mixer) {
        mixer.update(delta);
    }
    
    if (controls) {
        controls.update();
    }
    
    // Animación sutil del robot si existe
    if (robot && !isMobile) {
        robot.rotation.y += 0.001; // Rotación sutil adicional
    }
    
    renderer.render(scene, camera);
}

function showFallbackImage() {
    // Mostrar imagen de respaldo si el 3D falla
    container.innerHTML = `
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f8fafc 0%,#e2e8f0 100%);border-radius:20px;">
            <div style="text-align:center;padding:20px;">
                <i class="fas fa-robot" style="font-size:80px;color:#3b82f6;margin-bottom:20px;"></i>
                <p style="color:#4b5563;font-weight:600;">RoboWorks Interactive</p>
                <p style="color:#6b7280;font-size:14px;margin-top:5px;">Robot 3D educativo</p>
            </div>
        </div>
    `;
}

// Exportar para uso global (opcional)
window.RoboHero = {
    init: initRobot,
    scene: () => scene,
    robot: () => robot
};