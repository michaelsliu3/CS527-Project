import { Box } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'

interface Su7ThreeHeroProps {
  title: string
  /** When true, the viewer fills its parent and enables orbit interaction */
  interactive?: boolean
}

export function Su7ThreeHero({ title, interactive = false }: Su7ThreeHeroProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#000000')

    const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 200)
    camera.position.set(5.8, 1.9, 5.8)
    const baseCameraPosition = new THREE.Vector3(5.8, 1.9, 5.8)
    const lookTarget = new THREE.Vector3(0, 0.82, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.setClearColor('#000000', 1)
    mount.appendChild(renderer.domElement)

    let controls: OrbitControls | null = null
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.enablePan = false
      controls.minDistance = 3
      controls.maxDistance = 14
      controls.minPolarAngle = Math.PI * 0.15
      controls.maxPolarAngle = Math.PI * 0.55
      controls.target.set(0, 0.3, 0)
      controls.update()
    }

    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    const neutralScene = new THREE.Scene()
    const envLight1 = new THREE.DirectionalLight('#ffffff', 1.0)
    envLight1.position.set(1, 1, 1)
    neutralScene.add(envLight1)
    const envLight2 = new THREE.DirectionalLight('#ffffff', 0.5)
    envLight2.position.set(-1, 0.5, -1)
    neutralScene.add(envLight2)
    const envMap = pmremGenerator.fromScene(neutralScene, 0).texture
    scene.environment = envMap
    pmremGenerator.dispose()

    const ambient = new THREE.AmbientLight('#ffffff', 0.08)
    scene.add(ambient)

    const keySpot = new THREE.SpotLight('#fff8f0', 4.0, 30, Math.PI * 0.14, 0.7, 1.2)
    keySpot.position.set(5, 8, 4)
    keySpot.target.position.set(0, 0.5, 0)
    scene.add(keySpot)
    scene.add(keySpot.target)

    const fillSpot = new THREE.SpotLight('#e0e8ff', 2.0, 25, Math.PI * 0.18, 0.8, 1.0)
    fillSpot.position.set(-6, 5, 3)
    fillSpot.target.position.set(0, 0.5, 0)
    scene.add(fillSpot)
    scene.add(fillSpot.target)

    const rimSpot = new THREE.SpotLight('#d0d8ff', 2.5, 25, Math.PI * 0.12, 0.5, 1.0)
    rimSpot.position.set(-3, 4, -7)
    rimSpot.target.position.set(0, 0.5, 0)
    scene.add(rimSpot)
    scene.add(rimSpot.target)

    const topSpot = new THREE.SpotLight('#ffffff', 1.5, 20, Math.PI * 0.25, 0.9, 1.0)
    topSpot.position.set(0, 10, 0)
    topSpot.target.position.set(0, 0, 0)
    scene.add(topSpot)
    scene.add(topSpot.target)

    const accentFront = new THREE.PointLight('#ffffff', 0.6, 12)
    accentFront.position.set(3, 0.5, 5)
    scene.add(accentFront)

    const accentRear = new THREE.PointLight('#c8d0ff', 0.4, 10)
    accentRear.position.set(-4, 0.8, -4)
    scene.add(accentRear)

    // Reflective studio floor
    const floorGeo = new THREE.PlaneGeometry(60, 60)
    const floor = new Reflector(floorGeo, {
      clipBias: 0.003,
      textureWidth: 1024,
      textureHeight: 1024,
      color: new THREE.Color('#080808'),
    })
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0
    scene.add(floor)

    const fadeCanvas = document.createElement('canvas')
    fadeCanvas.width = 512
    fadeCanvas.height = 512
    const fadeCtx = fadeCanvas.getContext('2d')!
    const fadeGrad = fadeCtx.createRadialGradient(256, 256, 60, 256, 256, 256)
    fadeGrad.addColorStop(0, 'rgba(0,0,0,0)')
    fadeGrad.addColorStop(0.4, 'rgba(0,0,0,0.25)')
    fadeGrad.addColorStop(0.7, 'rgba(0,0,0,0.6)')
    fadeGrad.addColorStop(1, 'rgba(0,0,0,0.92)')
    fadeCtx.fillStyle = fadeGrad
    fadeCtx.fillRect(0, 0, 512, 512)
    const fadeTex = new THREE.CanvasTexture(fadeCanvas)
    const fadeOverlay = new THREE.Mesh(
      new THREE.CircleGeometry(25, 64),
      new THREE.MeshBasicMaterial({ map: fadeTex, transparent: true, depthWrite: false }),
    )
    fadeOverlay.rotation.x = -Math.PI / 2
    fadeOverlay.position.y = 0.002
    scene.add(fadeOverlay)

    const carGroup = new THREE.Group()
    scene.add(carGroup)

    // Fallback geometry while model loads
    const createFallbackCar = () => {
      const root = new THREE.Group()
      const bodyMat = new THREE.MeshPhysicalMaterial({
        color: '#0f172a',
        metalness: 0.9,
        roughness: 0.24,
        clearcoat: 0.9,
        clearcoatRoughness: 0.15,
      })
      const lower = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.55, 2.0), bodyMat)
      root.add(lower)
      const upper = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.55, 1.75), bodyMat)
      upper.position.set(-0.12, 0.55, 0)
      root.add(upper)

      const wheelMat = new THREE.MeshStandardMaterial({
        color: '#12161f',
        metalness: 0.5,
        roughness: 0.54,
      })
      const wheelGeo = new THREE.TorusGeometry(0.38, 0.14, 20, 30)
      const wheelOffsets = [
        [1.45, -0.34, 0.95],
        [1.45, -0.34, -0.95],
        [-1.45, -0.34, 0.95],
        [-1.45, -0.34, -0.95],
      ] as const
      const wheels = wheelOffsets.map(([x, y, z]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat)
        wheel.position.set(x, y, z)
        wheel.rotation.y = Math.PI / 2
        root.add(wheel)
        return wheel
      })

      return { root, wheels }
    }

    const fallback = createFallbackCar()
    carGroup.add(fallback.root)
    let activeRoot: THREE.Object3D = fallback.root
    let fallbackWheels = fallback.wheels
    let modelWheels: THREE.Object3D[] = []

    const fitCameraToObject = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object)
      if (box.isEmpty()) return

      const size = new THREE.Vector3()
      const center = new THREE.Vector3()
      box.getSize(size)
      box.getCenter(center)

      const fitHeightDistance = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)))
      const fitWidthDistance = size.x / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))) / Math.max(camera.aspect, 0.1)
      const fitDepthDistance = size.z * 1.15
      const distance = Math.max(fitHeightDistance, fitWidthDistance, fitDepthDistance) * 1.5

      lookTarget.set(center.x, center.y + size.y * 0.1, center.z)
      const direction = new THREE.Vector3(1, 0.32, 1).normalize()
      baseCameraPosition.copy(lookTarget).add(direction.multiplyScalar(distance))
      camera.position.copy(baseCameraPosition)
      camera.lookAt(lookTarget)

      if (controls) {
        controls.target.copy(lookTarget)
        controls.update()
      }
    }

    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    loader.load(
      '/models/su7.glb',
      (gltf) => {
        if (!mount.isConnected) return

        const modelRoot = gltf.scene
        const box = new THREE.Box3().setFromObject(modelRoot)
        const size = new THREE.Vector3()
        box.getSize(size)

        const longestSide = Math.max(size.x, size.z, 0.001)
        const scale = 5.1 / longestSide
        modelRoot.scale.setScalar(scale)

        const scaledBox = new THREE.Box3().setFromObject(modelRoot)
        const scaledCenter = new THREE.Vector3()
        scaledBox.getCenter(scaledCenter)

        modelRoot.position.x -= scaledCenter.x
        modelRoot.position.z -= scaledCenter.z
        modelRoot.position.y -= scaledBox.min.y

        const wheelNameRegex = /(wheel|tyre|tire|rim)/i
        const detectedWheels: THREE.Object3D[] = []
        modelRoot.traverse((object: THREE.Object3D) => {
          const mesh = object as THREE.Mesh
          if (wheelNameRegex.test(object.name)) {
            detectedWheels.push(object)
          }
          if (mesh.isMesh) {
            const materials = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material]
            materials.forEach((mat) => {
              const stdMat = mat as THREE.MeshStandardMaterial
              if (stdMat.envMapIntensity !== undefined) {
                stdMat.envMapIntensity = 1.8
              }
              if (stdMat.roughness !== undefined) {
                stdMat.roughness = Math.min(stdMat.roughness, 0.35)
              }
              const physMat = mat as THREE.MeshPhysicalMaterial
              if (physMat.clearcoat !== undefined) {
                physMat.clearcoat = Math.max(physMat.clearcoat, 0.8)
                physMat.clearcoatRoughness = Math.min(physMat.clearcoatRoughness ?? 0.1, 0.12)
              }
              stdMat.needsUpdate = true
            })
          }
        })

        carGroup.remove(activeRoot)
        activeRoot = modelRoot
        modelWheels = detectedWheels
        carGroup.add(activeRoot)
        fitCameraToObject(activeRoot)
        setLoaded(true)
      },
      undefined,
      () => {
        setLoaded(true)
      },
    )

    if (!interactive) {
      carGroup.rotation.y = -Math.PI * 0.2
    }

    const pointer = { x: 0, y: 0 }
    let isDriving = false
    let driveSpeed = 0
    let driveOffset = 0
    let onPointerMove: ((event: PointerEvent) => void) | null = null
    let onPointerLeave: (() => void) | null = null
    let onPointerDown: (() => void) | null = null
    let onPointerUp: (() => void) | null = null

    if (!interactive) {
      onPointerMove = (event: PointerEvent) => {
        const rect = mount.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1
      }
      onPointerLeave = () => {
        pointer.x = 0
        pointer.y = 0
        isDriving = false
      }
      onPointerDown = () => {
        isDriving = true
      }
      onPointerUp = () => {
        isDriving = false
      }
      mount.addEventListener('pointermove', onPointerMove)
      mount.addEventListener('pointerleave', onPointerLeave)
      mount.addEventListener('pointerdown', onPointerDown)
      window.addEventListener('pointerup', onPointerUp)
    }

    const setSize = () => {
      const width = mount.clientWidth
      const height = mount.clientHeight
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      fitCameraToObject(activeRoot)
    }
    setSize()

    const resizeObserver = new ResizeObserver(setSize)
    resizeObserver.observe(mount)

    setLoaded(true)

    const clock = new THREE.Clock()
    let elapsed = 0
    let raf = 0
    const animate = () => {
      const dt = Math.min(clock.getDelta(), 0.05)
      elapsed += dt
      const t = elapsed

      if (interactive) {
        controls?.update()
        carGroup.position.y = Math.sin(t * 1.2) * 0.02
      } else {
        if (isDriving) {
          driveSpeed = Math.min(driveSpeed + dt * 5.2, 3.2)
        } else {
          driveSpeed = Math.max(driveSpeed - dt * 6.6, 0)
        }
        driveOffset += driveSpeed * dt
        if (driveOffset > 1.5) {
          driveOffset = -1.5
        }

        carGroup.rotation.y += 0.0028
        carGroup.rotation.x = THREE.MathUtils.lerp(carGroup.rotation.x, -pointer.y * 0.08, 0.06)
        carGroup.position.x = driveOffset
        carGroup.position.y = 0.04 + Math.sin(t * 1.45) * 0.035
        carGroup.rotation.z = THREE.MathUtils.lerp(carGroup.rotation.z, -driveSpeed * 0.015, 0.12)

        const idleSpin = 0.012
        const driveSpin = driveSpeed * 0.09
        fallbackWheels.forEach((wheel) => {
          wheel.rotation.z += idleSpin + driveSpin
        })
        modelWheels.forEach((wheel) => {
          wheel.rotateX(idleSpin + driveSpin)
        })

        camera.position.x = THREE.MathUtils.lerp(camera.position.x, baseCameraPosition.x + pointer.x * 0.3, 0.05)
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, baseCameraPosition.y - pointer.y * 0.16, 0.05)
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, baseCameraPosition.z + pointer.x * 0.14, 0.05)
        camera.lookAt(lookTarget.x + pointer.x * 0.05, lookTarget.y - pointer.y * 0.03, lookTarget.z)
      }

      renderer.render(scene, camera)
      raf = window.requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      controls?.dispose()
      if (onPointerMove) mount.removeEventListener('pointermove', onPointerMove)
      if (onPointerLeave) mount.removeEventListener('pointerleave', onPointerLeave)
      if (onPointerDown) mount.removeEventListener('pointerdown', onPointerDown)
      if (onPointerUp) window.removeEventListener('pointerup', onPointerUp)
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      envMap.dispose()
      fadeTex.dispose()

      scene.traverse((object: THREE.Object3D) => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m: THREE.Material) => m.dispose())
        } else if (mesh.material) {
          mesh.material.dispose()
        }
      })
      renderer.dispose()
    }
  }, [interactive, title])

  return (
    <Box
      ref={mountRef}
      position="absolute"
      inset={0}
      bg="#000000"
      opacity={loaded ? 1 : 0.6}
      transition="opacity 0.5s ease"
    />
  )
}
