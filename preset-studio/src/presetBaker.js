import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { DiceBoardPhysics, BOUNDARY_MODES } from './DiceBoardPhysics.js';
import { YachtTrayModel } from './YachtTrayModel.js';

const DIE_SIZE = 1.62;
const DIE_HALF_SIZE = DIE_SIZE / 2;
const INGRESS_TIMEOUT_SECONDS = 1.4;
const DIE_SURFACE_CLEARANCE = 0.035;
const MAX_SETTLE_SECONDS = 2.0; // 요구사항: 주사위 굴림 완료 시간 2.0초 이내 필수

export class PresetBaker {
  constructor() {
    this.trayModel = new YachtTrayModel();
    this.layout = this.trayModel.getLayout();
    this.visualRandomState = null;
  }

  setVisualSeed(seed) {
    let state = 2166136261;
    for (const char of String(seed || 'local')) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
    this.visualRandomState = state || 1;
  }

  nextVisualRandom() {
    if (!this.visualRandomState) return Math.random();
    this.visualRandomState = (Math.imul(this.visualRandomState, 1664525) + 1013904223) >>> 0;
    return this.visualRandomState / 4294967296;
  }

  createWorld(isFlip = false) {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -95, 0) });
    world.broadphase = new CANNON.NaiveBroadphase();
    world.allowSleep = true;

    const defaultMaterial = new CANNON.Material('default');
    const contactMaterial = new CANNON.ContactMaterial(
      defaultMaterial, defaultMaterial, {
        friction: 0.65,
        restitution: 0.08
      }
    );
    world.addContactMaterial(contactMaterial);
    world.defaultMaterial = defaultMaterial;

    const boardPhysics = new DiceBoardPhysics(world);
    boardPhysics.configure(this.layout, isFlip ? BOUNDARY_MODES.FLIP : BOUNDARY_MODES.INGRESS);

    return { world, boardPhysics };
  }

  createDieBody(isOct, isHeavy) {
    let shape;
    if (isOct) {
      const r = 1.125;
      shape = new CANNON.ConvexPolyhedron({
        vertices: [
          new CANNON.Vec3(r, 0, 0), new CANNON.Vec3(-r, 0, 0),
          new CANNON.Vec3(0, r, 0), new CANNON.Vec3(0, -r, 0),
          new CANNON.Vec3(0, 0, r), new CANNON.Vec3(0, 0, -r)
        ],
        faces: [
          [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
          [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]
        ]
      });
    } else {
      shape = new CANNON.Box(new CANNON.Vec3(DIE_HALF_SIZE, DIE_HALF_SIZE, DIE_HALF_SIZE));
    }

    const body = new CANNON.Body({ mass: isHeavy ? 3 : 1, shape });
    body.linearDamping = 0.45;
    body.angularDamping = 0.70;
    body.allowSleep = true;
    body.sleepSpeedLimit = 0.35;
    body.sleepTimeLimit = 0.1;
    return body;
  }

  getDieSupportHeight(isOct) {
    return isOct ? 1.125 : DIE_HALF_SIZE;
  }

  createLaunchTransform(isOct, spawnIndex, count) {
    const random = () => this.nextVisualRandom();
    const supportHeight = this.getDieSupportHeight(isOct);
    
    // 슬롯별 인덱스
    const centerIndex = spawnIndex - (count - 1) / 2;
    const rowOffset = spawnIndex % 2;
    
    // 1. 발사 시작 위치: 뒤쪽 주사위도 림을 넉넉히 넘도록 발사점 고도 상향
    const startX = centerIndex * 0.25 + (random() - 0.5) * 0.05;
    const startZ = this.layout.launchOriginZ + rowOffset * 0.4;
    const startY = this.layout.playSurfaceY + supportHeight + 1.45 + (rowOffset * 0.25);
    
    // 2. 착지 목표 위치: 트레이 정중앙 집중 분산 (공중 충돌로 인한 고공 벽 튕김 방지)
    const spacingX = count > 4 ? 0.75 : (count > 2 ? 0.95 : 1.25);
    const targetX = THREE.MathUtils.clamp(
      centerIndex * spacingX + (random() - 0.5) * 0.12,
      -1.8,
      1.8
    );
    
    let zRowOffset;
    if (count >= 6) {
      zRowOffset = ((spawnIndex % 3) - 1) * 0.55; // 3열 엇갈림 배치 (-0.55, 0, +0.55)
    } else {
      zRowOffset = (spawnIndex % 2 === 0 ? 0.50 : -0.50) * (count > 1 ? 1 : 0);
    }
    const targetZ = THREE.MathUtils.clamp(1.2 + zRowOffset + (random() - 0.5) * 0.15, 0.6, 2.0);
    const landingY = this.layout.playSurfaceY + supportHeight + 0.04;

    // 3. 순수 물리 포물선 비행 계산 (림 통과 고도 마진 +0.55로 대폭 상향)
    const horizontalTravelTime = 0.35 + random() * 0.02 + rowOffset * 0.02;
    const gravity = 95;
    const horizontalVelocityZ = (targetZ - startZ) / horizontalTravelTime;
    const rimCrossingTime = Math.max(
      0.01,
      (this.layout.outerBounds.maxZ - startZ) / horizontalVelocityZ
    );
    const landingVelocityY = (landingY - startY + 0.5 * gravity * horizontalTravelTime ** 2) / horizontalTravelTime;
    const rimClearanceY = this.layout.rimTopY + supportHeight + 0.55;
    const rimClearVelocityY = (rimClearanceY - startY + 0.5 * gravity * rimCrossingTime ** 2) / rimCrossingTime;
    const launchVelocityY = Math.max(landingVelocityY, rimClearVelocityY);

    return {
      position: new CANNON.Vec3(startX, startY, startZ),
      velocity: new CANNON.Vec3(
        (targetX - startX) / horizontalTravelTime,
        launchVelocityY,
        horizontalVelocityZ
      ),
      angularVelocity: new CANNON.Vec3(
        (random() - 0.5) * 22,
        (random() - 0.5) * 22,
        (random() - 0.5) * 22
      ),
      target: { x: targetX, z: targetZ }
    };
  }

  launchDie(body, index, total, isFlip, isOct) {
    if (isFlip) {
      const centerIndex = index - (total - 1) / 2;
      body.position.set(centerIndex * 1.5, this.layout.playSurfaceY + DIE_HALF_SIZE + 0.8, 0);
      body.quaternion.setFromEuler(this.nextVisualRandom() * Math.PI, this.nextVisualRandom() * Math.PI, this.nextVisualRandom() * Math.PI);
      body.velocity.set(
        (this.nextVisualRandom() - 0.5) * 6.0,
        110 + this.nextVisualRandom() * 20,
        (this.nextVisualRandom() - 0.5) * 6.0
      );
      body.angularVelocity.set(
        (this.nextVisualRandom() - 0.5) * 80,
        (this.nextVisualRandom() - 0.5) * 80,
        (this.nextVisualRandom() - 0.5) * 80
      );
      return null;
    } else {
      const launch = this.createLaunchTransform(isOct, index, total);
      body.position.copy(launch.position);
      body.quaternion.setFromEuler(this.nextVisualRandom() * Math.PI, this.nextVisualRandom() * Math.PI, this.nextVisualRandom() * Math.PI);
      body.velocity.copy(launch.velocity);
      body.angularVelocity.copy(launch.angularVelocity);
      return launch.target;
    }
  }

  // 6면체 주사위가 바닥에 수평으로 온전히 안착했는지 검사 (Cocking 검사)
  isDieFlatOnFloorD6(body, expectedFloorY) {
    const q = body.quaternion;
    const tq = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    
    // 로컬 3개 축을 월드로 변환
    const axes = [
      new THREE.Vector3(1, 0, 0).applyQuaternion(tq),
      new THREE.Vector3(0, 1, 0).applyQuaternion(tq),
      new THREE.Vector3(0, 0, 1).applyQuaternion(tq)
    ];

    // 어떤 축이라도 월드 Up(0, 1, 0)과 평행한지 검사 (|dot| >= cos(10도) ≈ 0.985)
    const maxDot = Math.max(...axes.map(axis => Math.abs(axis.y)));
    if (maxDot < 0.985) {
      return false; // 비스듬히 기울어짐 (Cocking)
    }

    // Y 높이가 정상 착지 높이 오차 범위 이내인지 검사 (바닥에 온전히 닿음)
    const restY = expectedFloorY + DIE_HALF_SIZE;
    if (Math.abs(body.position.y - restY) > 0.12) {
      return false; // 경사로나 턱에 걸쳐서 떠 있음
    }

    return true;
  }

  // 8면체 주사위 안착 검사
  isDieFlatOnFloorD8(body, expectedFloorY) {
    const q = body.quaternion;
    const tq = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    
    // 8면체의 8개 면 법선 벡터 (정규화된 (±1, ±1, ±1) / sqrt(3))
    const invSqrt3 = 1 / Math.sqrt(3);
    const faceNormals = [
      new THREE.Vector3(invSqrt3, invSqrt3, invSqrt3),
      new THREE.Vector3(invSqrt3, invSqrt3, -invSqrt3),
      new THREE.Vector3(invSqrt3, -invSqrt3, invSqrt3),
      new THREE.Vector3(invSqrt3, -invSqrt3, -invSqrt3),
      new THREE.Vector3(-invSqrt3, invSqrt3, invSqrt3),
      new THREE.Vector3(-invSqrt3, invSqrt3, -invSqrt3),
      new THREE.Vector3(-invSqrt3, -invSqrt3, invSqrt3),
      new THREE.Vector3(-invSqrt3, -invSqrt3, -invSqrt3)
    ];

    const worldNormals = faceNormals.map(fn => fn.clone().applyQuaternion(tq));
    const maxDot = Math.max(...worldNormals.map(wn => Math.abs(wn.y)));
    if (maxDot < 0.980) {
      return false; // 면으로 착지하지 않고 모서리/꼭짓점으로 비스듬히 굄
    }

    const restY = expectedFloorY + (1.125 * invSqrt3);
    if (Math.abs(body.position.y - restY) > 0.12) {
      return false;
    }
    return true;
  }

  bakeSingle(mode, count = 5, octaCount = 0) {
    const isFlip = mode === 'flip';
    const isOct = mode === 'octahedron';
    const { world, boardPhysics } = this.createWorld(isFlip);
    this.setVisualSeed(`bake_${Math.random()}_${Date.now()}`);

    const allSlots = Array.from({ length: count }, (_, index) => index);
    for (let i = allSlots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allSlots[i], allSlots[j]] = [allSlots[j], allSlots[i]];
    }
    const spawnSlots = allSlots.slice(0, count);

    const dice = [];
    for (let i = 0; i < count; i++) {
      const dieIsOct = isOct ? (i >= Math.max(0, count - octaCount)) : false;
      const body = this.createDieBody(dieIsOct, false);
      const slotIndex = spawnSlots[i];
      const target = this.launchDie(body, slotIndex, count, isFlip, dieIsOct);
      
      world.addBody(body);
      dice.push({ body, target, hasReachedLaunchTarget: false, isOct: dieIsOct, initialY: body.position.y });
    }

    const timeStep = 1 / 60;
    const maxTime = isFlip ? 4.0 : 2.4; 
    const totalFrames = Math.ceil(maxTime / timeStep);
    const saveInterval = 3; // 20 FPS (60 / 3)
    const framesData = [];
    const soundEvents = [];
    
    let totalAngularMovement = 0;
    let ingressElapsed = 0;
    let settleFrame = -1;
    let settleTimeSeconds = 0;
    let quietStreak = 0;
    const speedThreshold = 0.35;
    const angThreshold = 0.55;
    let hasPlayedFirstImpact = false;
    let hasEscapedBounds = false;
    let escapedReason = '';
    let hasHighWallHit = false;
    let highWallHitReason = '';

    const safeBounds = {
      minX: this.layout.playBounds.minX + 0.3,
      maxX: this.layout.playBounds.maxX - 0.3,
      minZ: this.layout.playBounds.minZ + 0.3,
      maxZ: this.layout.playBounds.maxZ - 0.3
    };

    // 트레이 높이의 1.3배 고공 벽 충돌 한계선 계산
    const trayHeight = Math.max(1.0, this.layout.rimTopY - this.layout.playSurfaceY);
    const maxWallHitY = this.layout.playSurfaceY + (trayHeight * 1.3);
    const actualWallX = this.layout.playBounds.maxX - DIE_HALF_SIZE - 0.05; // 실제 좌우 벽면 접촉 위치

    for (let frame = 0; frame < totalFrames; frame++) {
      world.step(timeStep);
      const currentSeconds = frame * timeStep;
      ingressElapsed += timeStep;
      
      if (!isFlip) {
        // 착지 후 바닥에서 자연스러운 구름 감속 & 미세 지터링 방지 (인공 공중 급정거 완전 제거)
        if (currentSeconds >= 0.50) {
          dice.forEach(die => {
            const vLen = die.body.velocity.length();
            if (vLen < 3.0 && die.body.position.y <= this.layout.playSurfaceY + this.getDieSupportHeight(die.isOct) + 0.25) {
              die.body.velocity.scale(0.86, die.body.velocity);
              die.body.angularVelocity.scale(0.82, die.body.angularVelocity);
            }
          });
        }

        // 진입 경계 전환: 모든 주사위가 자연스럽게 트레이 경계 안으로 들어오면 전환 (강제 텔레포트/보정 완전 제거)
        if (boardPhysics.mode === BOUNDARY_MODES.INGRESS) {
          const movingDice = dice.filter(d => d.body);
          const isInside = die => die.body.position.z <= this.layout.entryEdgeZ - this.getDieSupportHeight(die.isOct);
          if (movingDice.every(isInside)) {
            boardPhysics.configure(this.layout, BOUNDARY_MODES.NORMAL);
          }
        }
      }

      // [신규 필터] 트레이 내부에서 트레이 높이 1.3배 초과 고공 벽 충돌 검사 (벽 상단에 부딪혀 튕기는 비현실적 모션 배제)
      if (!hasHighWallHit && !isFlip && currentSeconds > 0.20) {
        for (let i = 0; i < dice.length; i++) {
          const pos = dice[i].body.position;
          const vel = dice[i].body.velocity;
          const isInsideTrayZ = pos.z <= this.layout.entryEdgeZ - 0.2;
          const isBouncingOffSideWall = (pos.x >= 4.5 && vel.x < -1.0) || (pos.x <= -4.5 && vel.x > 1.0);
          if (isInsideTrayZ && isBouncingOffSideWall && pos.y > maxWallHitY) {
            hasHighWallHit = true;
            highWallHitReason = `트레이 높이 1.3배 초과 고공 벽 충돌 (주사위 ${i + 1}번: Y=${pos.y.toFixed(2)} > ${maxWallHitY.toFixed(2)})`;
            break;
          }
        }
      }

      // 실시간 트레이 이탈 검사 (착지 완료 시점 0.65s 이후 트레이 유효 범위를 벗어나면 즉시 탈락 마킹)
      if (!hasEscapedBounds && currentSeconds >= 0.65) {
        for (let i = 0; i < dice.length; i++) {
          const pos = dice[i].body.position;
          if (pos.x < safeBounds.minX || pos.x > safeBounds.maxX || pos.z < safeBounds.minZ || pos.z > safeBounds.maxZ) {
            hasEscapedBounds = true;
            escapedReason = `트레이 영역 이탈 (주사위 ${i + 1}번: X=${pos.x.toFixed(2)}, Z=${pos.z.toFixed(2)})`;
            break;
          }
        }
      }

      // 착지 사운드 이벤트 트리거 (첫 바닥 충돌 시)
      if (!hasPlayedFirstImpact) {
        for (const die of dice) {
          if (die.body.position.y <= this.layout.playSurfaceY + this.getDieSupportHeight(die.isOct) + 0.15) {
            soundEvents.push({
              time: Number(currentSeconds.toFixed(3)),
              type: 'roll',
              volume: 0.65,
              startOffset: 0
            });
            hasPlayedFirstImpact = true;
            break;
          }
        }
      }

      // 멈춤(안정화) 상태 추적 (연속 6스텝 동안 저속 유지)
      let allQuiet = true;
      for (const die of dice) {
        const linV = die.body.velocity.length();
        const angV = die.body.angularVelocity.length();
        if (linV > speedThreshold || angV > angThreshold) {
          allQuiet = false;
          break;
        }
      }

      if (allQuiet && currentSeconds >= 0.4) {
        quietStreak++;
        if (quietStreak >= 6 && settleFrame === -1) {
          settleFrame = frame - 3;
          settleTimeSeconds = (settleFrame * timeStep);
        }
      } else {
        quietStreak = 0;
      }

      if (frame % saveInterval === 0) {
        const frameState = dice.map(die => {
          totalAngularMovement += die.body.angularVelocity.lengthSquared();
          return [
            Number(die.body.position.x.toFixed(3)),
            Number(die.body.position.y.toFixed(3)),
            Number(die.body.position.z.toFixed(3)),
            Number(die.body.quaternion.x.toFixed(4)),
            Number(die.body.quaternion.y.toFixed(4)),
            Number(die.body.quaternion.z.toFixed(4)),
            Number(die.body.quaternion.w.toFixed(4))
          ];
        });
        framesData.push(frameState);
      }
    }

    // 최종 안정화 시간 산출
    const finalSettleTime = settleTimeSeconds > 0 ? settleTimeSeconds : maxTime;

    // ==========================================
    // 엄격한 품질 필터링 (Validation Filters)
    // ==========================================
    let isDisqualified = false;
    let disqualificationReason = '';

    // 1. [필터 1] 고공 벽 충돌 탈락 (1.3배 높이 초과 충돌)
    if (hasHighWallHit) {
      isDisqualified = true;
      disqualificationReason = highWallHitReason;
    }

    // 2. [필터 2] 실시간 트레이 이탈 탈락
    if (!isDisqualified && hasEscapedBounds) {
      isDisqualified = true;
      disqualificationReason = escapedReason;
    }

    // 3. [필터 3] 안정화 시간 2.0초 초과 탈락 (Flip 모드는 3.0초까지 허용)
    const allowedTime = isFlip ? 3.0 : MAX_SETTLE_SECONDS;
    if (!isDisqualified && finalSettleTime > allowedTime) {
      isDisqualified = true;
      disqualificationReason = `안정화 시간 초과 (${finalSettleTime.toFixed(2)}s > ${allowedTime}s)`;
    }

    // 3. [필터 3] 최종 정지 위치 트레이 경계 검사
    if (!isDisqualified) {
      for (let i = 0; i < dice.length; i++) {
        const pos = dice[i].body.position;
        if (pos.x < safeBounds.minX || pos.x > safeBounds.maxX ||
            pos.z < safeBounds.minZ || pos.z > safeBounds.maxZ) {
          isDisqualified = true;
          disqualificationReason = `트레이 영역 이탈 (X: ${pos.x.toFixed(2)}, Z: ${pos.z.toFixed(2)})`;
          break;
        }
      }
    }

    // 3. [필터 3] 주사위 스태킹(포개짐) 검사
    if (!isDisqualified) {
      for (let i = 0; i < dice.length; i++) {
        for (let j = i + 1; j < dice.length; j++) {
          const posA = dice[i].body.position;
          const posB = dice[j].body.position;
          const distXZ = Math.hypot(posA.x - posB.x, posA.z - posB.z);
          const distY = Math.abs(posA.y - posB.y);

          if (distXZ < DIE_SIZE * 0.85 && distY > DIE_SIZE * 0.45) {
            isDisqualified = true;
            disqualificationReason = `주사위 스태킹(포개짐) 발생 (거리: ${distXZ.toFixed(2)})`;
            break;
          }
        }
        if (isDisqualified) break;
      }
    }

    // 4. [필터 4] 불완전 안착 / 콕킹(Cocking) 검사
    if (!isDisqualified) {
      for (let i = 0; i < dice.length; i++) {
        const die = dice[i];
        const isFlat = die.isOct
          ? this.isDieFlatOnFloorD8(die.body, this.layout.playSurfaceY)
          : this.isDieFlatOnFloorD6(die.body, this.layout.playSurfaceY);
        
        if (!isFlat) {
          isDisqualified = true;
          disqualificationReason = `주사위 ${i + 1}번 불완전 안착(비스듬히 걸침)`;
          break;
        }
      }
    }

    // 점수 계산
    let score = 0;
    if (isDisqualified) {
      score = -9999;
    } else {
      let finalSpread = 0;
      let centerDistSum = 0;
      for (let i = 0; i < dice.length; i++) {
        const posA = dice[i].body.position;
        centerDistSum += Math.hypot(posA.x, posA.z - this.layout.activeCenterZ);
        for (let j = i + 1; j < dice.length; j++) {
          finalSpread += posA.distanceTo(dice[j].body.position);
        }
      }
      
      score = 40.0 + (finalSpread * 4.5) + (totalAngularMovement / 1500) - (centerDistSum * 1.2);
      if (score < 1) score = 1.0;
    }

    // 안정화 이후 3프레임 여유를 두고 프레임 클립 자르기 (용량 최적화 및 2초 이내 정지 보장)
    const effectiveFrameCount = settleFrame > 0
      ? Math.min(framesData.length, Math.ceil(settleFrame / saveInterval) + 3)
      : framesData.length;
    const trimmedFrames = framesData.slice(0, effectiveFrameCount);

    return {
      mode,
      diceCount: count,
      octaCount: octaCount,
      score: Number(score.toFixed(1)),
      settleTime: Number(finalSettleTime.toFixed(2)),
      isValid: !isDisqualified,
      disqualificationReason: disqualificationReason || '정상 통과',
      frames: trimmedFrames,
      length: trimmedFrames.length,
      fps: 20,
      soundEvents
    };
  }

  // 50개 단위 배치 생성 (요구사항: 50개 생성 후 사용자 검토)
  async bakeBatch(mode, diceCount = 5, octaCount = 0, batchSize = 50, onProgress = null) {
    const validResults = [];
    const allResults = [];
    
    for (let i = 0; i < batchSize; i++) {
      const result = this.bakeSingle(mode, diceCount, octaCount);
      allResults.push(result);
      if (result.isValid && result.score > 0) {
        validResults.push(result);
      }
      if (onProgress) {
        onProgress(i + 1, batchSize, validResults.length);
        await new Promise(r => setTimeout(r, 0));
      }
    }

    // 점수 높은 순으로 정렬
    validResults.sort((a, b) => b.score - a.score);
    return {
      validResults,
      allCount: batchSize,
      validCount: validResults.length
    };
  }
}
