import { Box } from '@chakra-ui/react'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'

interface Su7ThreeHeroProps {
  title: string
  modelKey?: 'su7' | 'praga'
  /** When true, the viewer fills its parent and enables orbit interaction */
  interactive?: boolean
  onDrivingChange?: (driving: boolean) => void
  onIntroComplete?: () => void
}

const COLOR_SWATCHES = [
  { id: 'yellow', hex: '#f5c542' },
  { id: 'silver', hex: '#c9ccd3' },
  { id: 'white', hex: '#f1f1f1' },
  { id: 'orange', hex: '#ff6440' },
  { id: 'blue-dark', hex: '#1f4aa6' },
  { id: 'black', hex: '#151515' },
] as const

const DEFAULT_SWATCH_ID = 'yellow'
const EXTERIOR_PAINT_MATERIAL_NAMES = new Set(['Car_body'])
const NON_PAINT_NAME_REGEX = /(glass|window|light|lamp|emissive|wheel|tire|tyre|rim|brake|disc|interior|seat|cockpit|driver|helmet)/i
const MODEL_CONFIGS: Record<
  'su7' | 'praga',
  {
    candidatePaths: string[]
    rootYaw: number
    rootLift: number
    wheelSpinDirection: 1 | -1
    wheelSpinAxis: 'x' | 'y' | 'z'
    introScaleStart: number
    introScaleEnd: number
    audioProfile: 'ev' | 'race-4cyl'
  }
> = {
  su7: {
    candidatePaths: ['/models/su7.glb'],
    rootYaw: 0,
    rootLift: 0,
    wheelSpinDirection: 1,
    wheelSpinAxis: 'z',
    introScaleStart: 0.5,
    introScaleEnd: 0.7,
    audioProfile: 'ev',
  },
  praga: {
    candidatePaths: ['/models/ac_-_praga_r1_free.glb'],
    rootYaw: Math.PI / 2,
    rootLift: 0.28,
    wheelSpinDirection: -1,
    wheelSpinAxis: 'x',
    introScaleStart: 0.5,
    introScaleEnd: 0.64,
    audioProfile: 'race-4cyl',
  },
}

export function Su7ThreeHero({
  title,
  modelKey = 'su7',
  interactive = false,
  onDrivingChange,
  onIntroComplete,
}: Su7ThreeHeroProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [selectedSwatchId, setSelectedSwatchId] = useState<string>(DEFAULT_SWATCH_ID)
  const [isDrivingUI, setIsDrivingUI] = useState(false)
  const [introCompleted, setIntroCompleted] = useState(false)
  const onDrivingChangeRef = useRef(onDrivingChange)
  onDrivingChangeRef.current = onDrivingChange
  const onIntroCompleteRef = useRef(onIntroComplete)
  onIntroCompleteRef.current = onIntroComplete

  const shouldHideUI = isDrivingUI || !introCompleted
  const paintMaterialsRef = useRef<THREE.MeshStandardMaterial[]>([])
  const fallbackBodyMaterialRef = useRef<THREE.MeshPhysicalMaterial | null>(null)
  const selectedColorRef = useRef<string>(COLOR_SWATCHES[0].hex)
  const currentPaintColorRef = useRef(new THREE.Color(COLOR_SWATCHES[0].hex))
  const targetPaintColorRef = useRef(new THREE.Color(COLOR_SWATCHES[0].hex))
  const transitionStartPaintColorRef = useRef(new THREE.Color(COLOR_SWATCHES[0].hex))
  const transitionProgressRef = useRef(1)

  useEffect(() => {
    const selected = COLOR_SWATCHES.find((swatch) => swatch.id === selectedSwatchId) ?? COLOR_SWATCHES[0]
    selectedColorRef.current = selected.hex
    transitionStartPaintColorRef.current.copy(currentPaintColorRef.current)
    targetPaintColorRef.current.set(selected.hex)
    transitionProgressRef.current = 0
  }, [selectedSwatchId])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    paintMaterialsRef.current = []
    fallbackBodyMaterialRef.current = null

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
    renderer.toneMappingExposure = 0
    renderer.setClearColor('#000000', 1)
    mount.appendChild(renderer.domElement)

    let entryLightFactor = 0
    const animatableLights: Array<{ light: THREE.Light; baseIntensity: number }> = []
    const registerAnimLight = <T extends THREE.Light>(light: T): T => {
      const baseIntensity = light.intensity
      animatableLights.push({ light, baseIntensity })
      light.intensity = baseIntensity * entryLightFactor
      return light
    }

    let controls: OrbitControls | null = null
    if (interactive) {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.06
      controls.enablePan = false
      controls.enableRotate = true
      controls.minDistance = 3
      controls.maxDistance = 14
      controls.minPolarAngle = Math.PI * 0.15
      controls.maxPolarAngle = Math.PI * 0.55
      controls.target.set(0, 0.3, 0)
      controls.enabled = false
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

    const ambient = registerAnimLight(new THREE.AmbientLight('#ffffff', 0.08))
    scene.add(ambient)

    const keySpot = registerAnimLight(new THREE.SpotLight('#fff8f0', 4.0, 30, Math.PI * 0.14, 0.7, 1.2))
    keySpot.position.set(5, 8, 4)
    keySpot.target.position.set(0, 0.5, 0)
    scene.add(keySpot)
    scene.add(keySpot.target)

    const fillSpot = registerAnimLight(new THREE.SpotLight('#ffffff', 2.0, 25, Math.PI * 0.18, 0.8, 1.0))
    fillSpot.position.set(-6, 5, 3)
    fillSpot.target.position.set(0, 0.5, 0)
    scene.add(fillSpot)
    scene.add(fillSpot.target)

    const rimSpot = registerAnimLight(new THREE.SpotLight('#ffffff', 2.5, 25, Math.PI * 0.12, 0.5, 1.0))
    rimSpot.position.set(-3, 4, -7)
    rimSpot.target.position.set(0, 0.5, 0)
    scene.add(rimSpot)
    scene.add(rimSpot.target)

    // Overhead studio rig: positioned high enough to stay out of frame, casting white light down.
    const overheadLightPositions: ReadonlyArray<[number, number, number]> = [
      [0, 16, 0],
      [3.8, 15, 2.8],
      [-3.8, 15, -2.8],
    ]
    overheadLightPositions.forEach(([x, y, z]) => {
      const overhead = registerAnimLight(new THREE.SpotLight('#ffffff', 7.5, 60, Math.PI * 0.16, 0.45, 1.0))
      overhead.position.set(x, y, z)
      overhead.target.position.set(0, 0.2, 0)
      scene.add(overhead)
      scene.add(overhead.target)
    })

    const overheadFill = registerAnimLight(new THREE.DirectionalLight('#ffffff', 1.4))
    overheadFill.position.set(0, 18, 0)
    overheadFill.target.position.set(0, 0, 0)
    scene.add(overheadFill)
    scene.add(overheadFill.target)

    const accentFront = registerAnimLight(new THREE.PointLight('#ffffff', 0.6, 12))
    accentFront.position.set(3, 0.5, 5)
    scene.add(accentFront)

    const accentRear = registerAnimLight(new THREE.PointLight('#ffffff', 0.3, 10))
    accentRear.position.set(-4, 0.8, -4)
    scene.add(accentRear)

    // Reflective studio floor
    const floorGeo = new THREE.PlaneGeometry(60, 60)
    const floor = new Reflector(floorGeo, {
      clipBias: 0.003,
      textureWidth: 1024,
      textureHeight: 1024,
      color: new THREE.Color('#c0c0c0'),
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
    fadeGrad.addColorStop(0.45, 'rgba(0,0,0,0.16)')
    fadeGrad.addColorStop(0.75, 'rgba(0,0,0,0.38)')
    fadeGrad.addColorStop(1, 'rgba(0,0,0,0.62)')
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

    const SPEED_LINE_COUNT = 400
    const slGeo = (() => {
      const segs = 10
      const curve = 0.07
      const th = 0.012
      const pos: number[] = []
      const idx: number[] = []

      pos.push(-0.5, 0, 0)

      for (let s = 1; s < segs; s++) {
        const t = s / segs
        const x = t - 0.5
        const yOff = curve * Math.sin(Math.PI * t)
        const r = th * Math.sin(Math.PI * t)
        pos.push(x, yOff + r, 0)
        pos.push(x, yOff, r)
        pos.push(x, yOff - r, 0)
        pos.push(x, yOff, -r)
      }

      const tipIdx = pos.length / 3
      pos.push(0.5, 0, 0)

      for (let i = 0; i < 4; i++) {
        idx.push(0, 1 + i, 1 + ((i + 1) % 4))
      }
      for (let s = 0; s < segs - 2; s++) {
        const r1 = 1 + s * 4
        const r2 = 1 + (s + 1) * 4
        for (let i = 0; i < 4; i++) {
          const n = (i + 1) % 4
          idx.push(r1 + i, r2 + i, r2 + n)
          idx.push(r1 + i, r2 + n, r1 + n)
        }
      }
      const lastR = 1 + (segs - 2) * 4
      for (let i = 0; i < 4; i++) {
        idx.push(lastR + i, tipIdx, lastR + ((i + 1) % 4))
      }

      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.setIndex(idx)
      geo.computeVertexNormals()
      return geo
    })()
    const slMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const speedLines = new THREE.InstancedMesh(slGeo, slMat, SPEED_LINE_COUNT)
    speedLines.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    speedLines.frustumCulled = false

    const slPalette = [
      new THREE.Color('#8b5cf6'),
      new THREE.Color('#06b6d4'),
      new THREE.Color('#a78bfa'),
      new THREE.Color('#e0e7ff'),
      new THREE.Color('#3b82f6'),
      new THREE.Color('#ec4899'),
      new THREE.Color('#22d3ee'),
      new THREE.Color('#c084fc'),
    ]
    const slData = Array.from({ length: SPEED_LINE_COUNT }, (_, i) => {
      speedLines.setColorAt(i, slPalette[Math.floor(Math.random() * slPalette.length)])
      return {
        angle: Math.random() * Math.PI * 2,
        radius: 1.2 + Math.random() * 4.5,
        x: (Math.random() - 0.5) * 20,
        baseLength: 0.8 + Math.random() * 3.5,
        speed: 0.5 + Math.random() * 0.8,
      }
    })
    speedLines.instanceColor!.needsUpdate = true
    const slDummy = new THREE.Object3D()
    scene.add(speedLines)

    const carGroup = new THREE.Group()
    scene.add(carGroup)
    const carVerticalOffset = -0.18
    let entryScaleCurrent = 0.6
    carGroup.scale.setScalar(entryScaleCurrent)

    // Fallback geometry while model loads
    const createFallbackCar = () => {
      const root = new THREE.Group()
      const bodyMat = new THREE.MeshPhysicalMaterial({
        color: selectedColorRef.current,
        metalness: 0.9,
        roughness: 0.24,
        clearcoat: 0.9,
        clearcoatRoughness: 0.15,
      })
      fallbackBodyMaterialRef.current = bodyMat
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
    const fallbackWheels = fallback.wheels
    let modelWheels: THREE.Object3D[] = []
    let spoilerNode: THREE.Object3D | null = null
    let spoilerBaseRotZ = 0
    let spoilerBaseY = 0
    let spoilerCurrentAngle = 0
    let spoilerCurrentLift = 0
    let hasUserInteracted = false
    const SPOILER_INTRO_ANGLE = -0.08
    const SPOILER_FULL_ANGLE = -0.25
    const SPOILER_LIFT = 0.1

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

      const compositionOffsetX = 0
      // Aim slightly above center so the car sits lower in frame.
      lookTarget.set(center.x + compositionOffsetX, center.y + size.y * 0.25, center.z)
      const direction = interactive
        ? new THREE.Vector3(0, 0.0, -1).normalize()
        : new THREE.Vector3(1, 0.32, 1).normalize()
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
    const rotateWheelBy = (wheel: THREE.Object3D, amount: number) => {
      const signedAmount = amount * MODEL_CONFIGS[modelKey].wheelSpinDirection
      const axis = MODEL_CONFIGS[modelKey].wheelSpinAxis
      if (axis === 'x') {
        wheel.rotateX(signedAmount)
      } else if (axis === 'y') {
        wheel.rotateY(signedAmount)
      } else {
        wheel.rotateZ(signedAmount)
      }
    }

    const handleModelLoaded = (gltf: { scene: THREE.Group }) => {
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
        modelRoot.position.y += MODEL_CONFIGS[modelKey].rootLift
        modelRoot.rotation.y = MODEL_CONFIGS[modelKey].rootYaw

        const wheelNameRegex = /(wheel|tyre|tire|rim)/i
        const allWheelCandidates: THREE.Object3D[] = []
        const lightNodeRegex = /^(Light|LightGlass)\./
        const exteriorPaintMaterials = new Set<THREE.MeshStandardMaterial>()
        const fallbackExteriorPaintMaterials = new Set<THREE.MeshStandardMaterial>()

        modelRoot.updateMatrixWorld(true)
        const _wPos = new THREE.Vector3()

        modelRoot.traverse((object: THREE.Object3D) => {
          const mesh = object as THREE.Mesh
          if (wheelNameRegex.test(object.name)) {
            allWheelCandidates.push(object)
          }
          if (object.name === 'WeiYi') {
            spoilerNode = object
          }

          if (mesh.isMesh) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]

            const onLightNode = lightNodeRegex.test(object.name)
              || (object.parent && lightNodeRegex.test(object.parent.name))

            if (onLightNode) {
              mesh.getWorldPosition(_wPos)
              const isFront = _wPos.x > 0
              mats.forEach((mat) => {
                const stdMat = mat as THREE.MeshStandardMaterial
                if (stdMat.emissiveMap) {
                  stdMat.emissiveIntensity = isFront ? 5 : 4
                } else if (stdMat.name === 'Car_window') {
                  stdMat.emissive = new THREE.Color('#fffbe8')
                  stdMat.emissiveIntensity = isFront ? 1.5 : 1
                } else {
                  stdMat.emissive = new THREE.Color('#fffbe8')
                  stdMat.emissiveIntensity = isFront ? 3 : 1.6
                }
                stdMat.needsUpdate = true
              })
            }

            mats.forEach((mat) => {
              const stdMat = mat as THREE.MeshStandardMaterial
              if (EXTERIOR_PAINT_MATERIAL_NAMES.has(stdMat.name) || stdMat.name.toLowerCase() === 'car_body') {
                exteriorPaintMaterials.add(stdMat)
              }
              const meshName = object.name.toLowerCase()
              const materialName = stdMat.name.toLowerCase()
              const looksLikePaintableSurface = !NON_PAINT_NAME_REGEX.test(meshName) && !NON_PAINT_NAME_REGEX.test(materialName)
              const isLikelyWindow = stdMat.transparent && (stdMat.opacity ?? 1) < 0.98
              if (looksLikePaintableSurface && !isLikelyWindow) {
                fallbackExteriorPaintMaterials.add(stdMat)
              }
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

        if (exteriorPaintMaterials.size === 0 && modelKey === 'praga') {
          paintMaterialsRef.current = Array.from(fallbackExteriorPaintMaterials)
        } else {
          paintMaterialsRef.current = Array.from(exteriorPaintMaterials)
        }

        const candidateSet = new Set(allWheelCandidates)
        const detectedWheels = allWheelCandidates.filter((obj) => {
          let hasDescendantCandidate = false
          obj.traverse((child) => {
            if (child !== obj && candidateSet.has(child)) hasDescendantCandidate = true
          })
          return !hasDescendantCandidate
        })

        const selectedColor = currentPaintColorRef.current
        paintMaterialsRef.current.forEach((material) => {
          material.color.copy(selectedColor)
          material.needsUpdate = true
        })

        carGroup.remove(activeRoot)
        activeRoot = modelRoot
        modelWheels = detectedWheels
        carGroup.add(activeRoot)

        if (spoilerNode) {
          spoilerBaseRotZ = spoilerNode.rotation.z
          spoilerBaseY = spoilerNode.position.y
        }

        // Invisible light sources at known model positions (car faces +X)
        const fBox = new THREE.Box3().setFromObject(modelRoot)
        const cSize = new THREE.Vector3()
        const cCenter = new THREE.Vector3()
        fBox.getSize(cSize)
        fBox.getCenter(cCenter)
        const halfW = cSize.z * 0.42

        // Headlights — two SpotLights at the front casting forward
        ;[halfW, -halfW].forEach((z) => {
          const spot = registerAnimLight(new THREE.SpotLight('#fffbe6', 8, 18, Math.PI * 0.3, 0.7, 1.2))
          spot.position.set(fBox.max.x, cCenter.y * 0.5, z)
          spot.target.position.set(fBox.max.x + 6, -0.5, z)
          carGroup.add(spot, spot.target)
        })

        fitCameraToObject(activeRoot)
        setLoaded(true)
    }

    const loadModelCandidate = (index: number) => {
      const modelPath = MODEL_CONFIGS[modelKey].candidatePaths[index]
      if (!modelPath) {
        setLoaded(true)
        return
      }

      loader.load(
        modelPath,
        handleModelLoaded,
        undefined,
        () => loadModelCandidate(index + 1),
      )
    }

    loadModelCandidate(0)

    if (!interactive) {
      carGroup.rotation.y = -Math.PI * 0.2
      carGroup.position.y = carVerticalOffset
    } else {
      // Model faces +X; this keeps the car front pointing screen-left in side view.
      carGroup.rotation.y = 0
      carGroup.position.x = 0
      carGroup.position.y = carVerticalOffset
    }

    let audioCtx: AudioContext | null = null
    let masterGain: GainNode | null = null
    const oscBank: OscillatorNode[] = []
    const oscGainBank: GainNode[] = []
    const oscBaseFreqs: number[] = []
    let whineOsc: OscillatorNode | null = null
    let whineGain: GainNode | null = null
    let audioStarted = false
    let previousDriveSpeed = 0
    let accelTransient = 0

    const initAudio = () => {
      if (audioStarted) return
      audioStarted = true
      audioCtx = new AudioContext()
      const audioProfile = MODEL_CONFIGS[modelKey].audioProfile

      const hpf = audioCtx.createBiquadFilter()
      hpf.type = 'highpass'
      hpf.frequency.value = audioProfile === 'race-4cyl' ? 90 : 45
      hpf.Q.value = 0.7
      const lpf = audioCtx.createBiquadFilter()
      lpf.type = 'lowpass'
      lpf.frequency.value = audioProfile === 'race-4cyl' ? 3200 : 1600
      lpf.Q.value = audioProfile === 'race-4cyl' ? 1.0 : 0.7
      hpf.connect(lpf)
      lpf.connect(audioCtx.destination)

      masterGain = audioCtx.createGain()
      masterGain.gain.value = 0
      masterGain.connect(hpf)

      if (audioProfile === 'race-4cyl') {
        const raceHarmonics = [
          { base: 85, type: 'sawtooth' as OscillatorType, gain: 0.55 },
          { base: 170, type: 'square' as OscillatorType, gain: 0.2 },
          { base: 255, type: 'triangle' as OscillatorType, gain: 0.16 },
          { base: 340, type: 'sine' as OscillatorType, gain: 0.1 },
        ]
        raceHarmonics.forEach((harmonic) => {
          const osc = audioCtx!.createOscillator()
          osc.type = harmonic.type
          osc.frequency.value = harmonic.base
          const gainNode = audioCtx!.createGain()
          gainNode.gain.value = 0
          osc.connect(gainNode)
          gainNode.connect(masterGain!)
          osc.start()
          oscBank.push(osc)
          oscGainBank.push(gainNode)
          oscBaseFreqs.push(harmonic.base)
        })
      } else {
        const humFreqs = [100, 200, 300]
        humFreqs.forEach((freq) => {
          const osc = audioCtx!.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = freq
          const gainNode = audioCtx!.createGain()
          gainNode.gain.value = 0
          osc.connect(gainNode)
          gainNode.connect(masterGain!)
          osc.start()
          oscBank.push(osc)
          oscGainBank.push(gainNode)
          oscBaseFreqs.push(freq)
        })
      }

      whineGain = audioCtx.createGain()
      whineGain.gain.value = 0
      whineOsc = audioCtx.createOscillator()
      if (audioProfile === 'race-4cyl') {
        whineOsc.type = 'sawtooth'
        whineOsc.frequency.value = 1200
      } else {
        whineOsc.type = 'triangle'
        whineOsc.frequency.value = 800
      }
      whineOsc.connect(whineGain)
      whineGain.connect(hpf)
      whineOsc.start()
    }

    const pointer = { x: 0, y: 0 }
    let isDriving = false
    let driveSpeed = 0
    let driveOffset = 0
    let onPointerMove: ((event: PointerEvent) => void) | null = null
    let onPointerLeave: (() => void) | null = null
    let onPointerDown: (() => void) | null = null
    let onPointerUp: (() => void) | null = null

    onPointerDown = () => {
      initAudio()
      isDriving = true
      hasUserInteracted = true
      setIsDrivingUI(true)
      onDrivingChangeRef.current?.(true)
    }
    onPointerUp = () => {
      isDriving = false
      setIsDrivingUI(false)
      onDrivingChangeRef.current?.(false)
    }
    mount.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)

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
      mount.addEventListener('pointermove', onPointerMove)
      mount.addEventListener('pointerleave', onPointerLeave)
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

    const clock = new THREE.Clock()
    let elapsed = 0
    let entryBlend = 0
    let introComplete = false
    let driveDimRef = 1
    let raf = 0
    const animate = () => {
      const dt = Math.min(clock.getDelta(), 0.05)
      elapsed += dt
      const t = elapsed
      transitionProgressRef.current = Math.min(transitionProgressRef.current + dt / 0.9, 1)
      const easedPaintTransition = THREE.MathUtils.smootherstep(transitionProgressRef.current, 0, 1)
      currentPaintColorRef.current
        .copy(transitionStartPaintColorRef.current)
        .lerp(targetPaintColorRef.current, easedPaintTransition)
      paintMaterialsRef.current.forEach((material) => {
        material.color.copy(currentPaintColorRef.current)
      })
      if (fallbackBodyMaterialRef.current) {
        fallbackBodyMaterialRef.current.color.copy(currentPaintColorRef.current)
      }
      // Cinematic entry: slow -> fast -> slow zoom with smooth easing.
      entryBlend = Math.min(entryBlend + dt / 2.8, 1)
      const zoomEase = THREE.MathUtils.smootherstep(entryBlend, 0, 1)
      const introConfig = MODEL_CONFIGS[modelKey]
      const targetScale = THREE.MathUtils.lerp(introConfig.introScaleStart, introConfig.introScaleEnd, zoomEase)
      const smoothing = 1 - Math.exp(-dt * 5.6)
      entryScaleCurrent = THREE.MathUtils.lerp(entryScaleCurrent, targetScale, smoothing)
      carGroup.scale.setScalar(entryScaleCurrent)
      entryLightFactor = THREE.MathUtils.smootherstep(Math.max(0, (entryBlend - 0.08) / 0.92), 0, 1)
      const driveDimTarget = Math.max(0.15, 1 - driveSpeed / 10)
      driveDimRef = THREE.MathUtils.lerp(driveDimRef, driveDimTarget, 1 - Math.exp(-dt * 12))
      animatableLights.forEach(({ light, baseIntensity }) => {
        light.intensity = baseIntensity * entryLightFactor * driveDimRef
      })
      renderer.toneMappingExposure = THREE.MathUtils.lerp(0, 1.1, entryLightFactor) * driveDimRef

      if (interactive) {
        if (!introComplete) {
          camera.position.lerp(baseCameraPosition, 0.18)
          camera.lookAt(lookTarget)
          controls?.target.lerp(lookTarget, 0.25)
          if (entryBlend >= 1) {
            introComplete = true
            setIntroCompleted(true)
            onIntroCompleteRef.current?.()
            if (controls) {
              controls.target.copy(lookTarget)
              controls.enabled = true
            }
          }
        }
        controls?.update()
        carGroup.position.x = 0
        carGroup.position.y = carVerticalOffset + Math.sin(t * 1.2) * 0.02

        if (isDriving) {
          const accel = 1.2 + driveSpeed * 0.6
          driveSpeed = Math.min(driveSpeed + dt * accel, 8.0)
        } else {
          driveSpeed = Math.max(driveSpeed - dt * 4.0, 0)
        }
        const interactiveSpin = driveSpeed * 0.12
        fallbackWheels.forEach((wheel) => {
          wheel.rotation.z -= interactiveSpin
        })
        modelWheels.forEach((wheel) => {
          rotateWheelBy(wheel, -interactiveSpin)
        })
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
        carGroup.position.y = carVerticalOffset + 0.04 + Math.sin(t * 1.45) * 0.035
        carGroup.rotation.z = THREE.MathUtils.lerp(carGroup.rotation.z, -driveSpeed * 0.015, 0.12)

        const idleSpin = 0.012
        const driveSpin = driveSpeed * 0.09
        fallbackWheels.forEach((wheel) => {
          wheel.rotation.z += idleSpin + driveSpin
        })
        modelWheels.forEach((wheel) => {
          rotateWheelBy(wheel, idleSpin + driveSpin)
        })

        camera.position.x = THREE.MathUtils.lerp(camera.position.x, baseCameraPosition.x + pointer.x * 0.3, 0.05)
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, baseCameraPosition.y - pointer.y * 0.16, 0.05)
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, baseCameraPosition.z + pointer.x * 0.14, 0.05)
        camera.lookAt(lookTarget.x + pointer.x * 0.05, lookTarget.y - pointer.y * 0.03, lookTarget.z)
      }

      if (spoilerNode) {
        const speedNorm = Math.min(driveSpeed / 5, 1)
        const eased = speedNorm * speedNorm

        let targetAngle: number
        let targetLift: number
        if (entryBlend > 0.3 && !hasUserInteracted) {
          targetAngle = SPOILER_INTRO_ANGLE
          targetLift = 0
        } else if (isDriving) {
          targetAngle = SPOILER_INTRO_ANGLE + (SPOILER_FULL_ANGLE - SPOILER_INTRO_ANGLE) * eased
          targetLift = SPOILER_LIFT
        } else {
          targetAngle = 0
          targetLift = 0
        }

        const opening = Math.abs(targetAngle) > Math.abs(spoilerCurrentAngle)
        const rate = opening ? 2.2 + speedNorm * 1.8 : 1.8
        spoilerCurrentAngle = THREE.MathUtils.lerp(
          spoilerCurrentAngle,
          targetAngle,
          1 - Math.exp(-dt * rate),
        )
        spoilerCurrentLift = THREE.MathUtils.lerp(
          spoilerCurrentLift,
          targetLift,
          1 - Math.exp(-dt * rate),
        )
        spoilerNode.rotation.z = spoilerBaseRotZ + spoilerCurrentAngle
        spoilerNode.position.y = spoilerBaseY + spoilerCurrentLift
      }

      const baseFov = 35
      const maxFovRange = 40
      const targetFov = baseFov + (driveSpeed / 8.0) * maxFovRange
      const fovProgress = Math.abs(camera.fov - targetFov) / maxFovRange
      const fovRate = THREE.MathUtils.smootherstep(fovProgress, 0, 0.5) * 4.0 + 0.3
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-dt * fovRate))
      camera.updateProjectionMatrix()

      const slTargetOpacity = driveSpeed > 0.05 ? Math.min(driveSpeed / 2.5, 0.8) : 0
      const slFadeRate = slMat.opacity < slTargetOpacity ? dt * 0.35 : dt * 3.5
      slMat.opacity = THREE.MathUtils.lerp(slMat.opacity, slTargetOpacity, slFadeRate)

      if (driveSpeed > 0.01 || slMat.opacity > 0.01) {
        for (let i = 0; i < SPEED_LINE_COUNT; i++) {
          const d = slData[i]
          d.x -= d.speed * driveSpeed * dt * 6
          if (d.x < -10) {
            d.x = 10 + Math.random() * 4
            d.angle = Math.random() * Math.PI * 2
            d.radius = 1.2 + Math.random() * 4.5
          }
          const y = Math.cos(d.angle) * d.radius
          const z = Math.sin(d.angle) * d.radius
          const len = d.baseLength
          slDummy.position.set(d.x, y, z)
          slDummy.scale.set(len, 1, 1)
          slDummy.updateMatrix()
          speedLines.setMatrixAt(i, slDummy.matrix)
        }
        speedLines.instanceMatrix.needsUpdate = true
      }

      if (audioCtx && masterGain && oscBank.length) {
        const speedNorm = driveSpeed / 8.0
        const now = audioCtx.currentTime
        const audioProfile = MODEL_CONFIGS[modelKey].audioProfile
        const accelDelta = Math.max(driveSpeed - previousDriveSpeed, 0)
        previousDriveSpeed = driveSpeed
        accelTransient = Math.max(accelTransient * Math.exp(-dt * 8), Math.min(accelDelta * 3.2, 1))

        if (audioProfile === 'race-4cyl') {
          const rpmNorm = THREE.MathUtils.clamp(0.2 + speedNorm * 0.8 + accelTransient * 0.16, 0, 1)
          const firingFreq = THREE.MathUtils.lerp(90, 250, rpmNorm)
          const multipliers = [1, 2, 3, 4]
          const gains = [0.9, 0.45, 0.3, 0.2]
          oscBank.forEach((osc, i) => {
            osc.frequency.setTargetAtTime(firingFreq * multipliers[i], now, 0.05)
            oscGainBank[i]?.gain.setTargetAtTime(gains[i] * (0.25 + speedNorm * 0.75), now, 0.08)
          })
          masterGain.gain.setTargetAtTime(0.02 + speedNorm * 0.05 + accelTransient * 0.02, now, 0.08)
        } else {
          const rev = 1 + speedNorm * 1.5
          oscBank.forEach((osc, i) => {
            osc.frequency.setTargetAtTime(oscBaseFreqs[i] * rev, now, 0.1)
            oscGainBank[i]?.gain.setTargetAtTime(0.5, now, 0.15)
          })
          masterGain.gain.setTargetAtTime(speedNorm * 0.035, now, 0.15)
        }

        if (whineOsc && whineGain) {
          if (audioProfile === 'race-4cyl') {
            whineOsc.frequency.setTargetAtTime(1100 + speedNorm * 2200 + accelTransient * 350, now, 0.05)
            whineGain.gain.setTargetAtTime(0.003 + Math.pow(speedNorm, 1.2) * 0.025, now, 0.08)
          } else {
            whineOsc.frequency.setTargetAtTime(800 + speedNorm * 800, now, 0.08)
            whineGain.gain.setTargetAtTime(Math.pow(speedNorm, 1.5) * 0.05, now, 0.12)
          }
        }
      }

      renderer.render(scene, camera)
      raf = window.requestAnimationFrame(animate)
    }
    animate()

    const onVisibilityChange = () => {
      if (audioCtx) {
        if (document.hidden) {
          audioCtx.suspend()
        } else {
          audioCtx.resume()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      oscBank.forEach((o) => o.stop())
      if (whineOsc) whineOsc.stop()
      if (audioCtx) audioCtx.close()
      resizeObserver.disconnect()
      controls?.dispose()
      paintMaterialsRef.current = []
      fallbackBodyMaterialRef.current = null
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
  }, [interactive, modelKey, title])

  return (
    <Box position="absolute" inset={0}>
      <Box
        ref={mountRef}
        position="absolute"
        inset={0}
        bg="#000000"
        opacity={loaded ? 1 : 0.6}
        transition="opacity 0.5s ease"
      />

      <Box
        position="absolute"
        right={{ base: '12px', md: '20px' }}
        top={{ base: '40px', md: '52px' }}
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap={{ base: '6px', md: '7px' }}
        px={{ base: '6px', md: '7px' }}
        py={{ base: '7px', md: '9px' }}
        borderRadius="22px"
        bg="linear-gradient(180deg, rgba(25, 38, 48, 0.76) 0%, rgba(18, 28, 36, 0.72) 100%)"
        border="1px solid rgba(255,255,255,0.22)"
        boxShadow="0 10px 26px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.16)"
        backdropFilter="blur(12px) saturate(125%)"
        zIndex={3}
        pointerEvents={shouldHideUI ? 'none' : 'auto'}
        opacity={shouldHideUI ? 0 : 1}
        transition={shouldHideUI ? 'opacity 0.15s ease-out' : 'opacity 0.8s ease-in-out'}
      >
        {COLOR_SWATCHES.map((swatch) => {
          const isSelected = swatch.id === selectedSwatchId
          return (
            <Box
              as="button"
              key={swatch.id}
              aria-label={`Set car color ${swatch.id}`}
              onClick={() => setSelectedSwatchId(swatch.id)}
              w={{ base: '18px', md: '20px' }}
              h={{ base: '18px', md: '20px' }}
              borderRadius="full"
              bg={swatch.hex}
              border={isSelected ? '2px solid rgba(255,255,255,0.95)' : '1px solid rgba(255,255,255,0.45)'}
              boxShadow={isSelected ? '0 0 0 2px rgba(255, 199, 71, 0.26), 0 2px 10px rgba(0,0,0,0.35)' : '0 1px 4px rgba(0,0,0,0.28)'}
              transform={isSelected ? 'scale(1.06)' : 'scale(1)'}
              transition="all 0.24s cubic-bezier(0.22, 1, 0.36, 1)"
              _hover={{ transform: isSelected ? 'scale(1.09)' : 'scale(1.04)' }}
              _active={{ transform: isSelected ? 'scale(1.03)' : 'scale(0.98)' }}
            />
          )
        })}
      </Box>
    </Box>
  )
}
