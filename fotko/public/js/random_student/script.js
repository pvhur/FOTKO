document.addEventListener('DOMContentLoaded', function() {
  // 아바타 이미지 URL 배열 (실제 프로젝트에 맞게 조정 필요)
  const avatarImages = [
    'avatars-3-d-avatar-10.png',
    'avatars-3-d-avatar-11.png',
    'avatars-3-d-avatar-12.png',
    'avatars-3-d-avatar-13.png',
    'avatars-3-d-avatar-14.png'
  ];

  // 변수 및 요소 초기화
  const carouselElement = document.querySelector('.avatar-carousel');
  const selectButton = document.querySelector('.depth-5-frame-04');
  const selectionIndicator = document.querySelector('.selection-indicator');
  const studentCountInput = document.getElementById('studentCount');
  const applyCountButton = document.getElementById('applyCount');
  
  let isSpinning = false;
  let selectedAvatarIndex = -1;
  let prevSelectedStudents = [];
  let availableAvatars = [...Array(20).keys()]; // 0-19 인덱스 배열
  let animationInterval = null;
  let lotteryAnimationId = null; // 추첨 애니메이션 ID 저장 변수 추가
  const TOTAL_ANIMATION_TIME = 15000; // 15초
  let normalSpeed = 2; // 기본 이동 속도 (픽셀/프레임)
  let carouselRunning = false; // 캐러셀 애니메이션 상태 추적

  // 학생 수 적용 버튼 이벤트 리스너
  applyCountButton.addEventListener('click', function() {
    const newCount = parseInt(studentCountInput.value);
    if (newCount >= 1 && newCount <= 50) {
      // 현재 선택된 학생들 저장
      const currentSelected = [...prevSelectedStudents];
      if (selectedAvatarIndex !== -1) {
        currentSelected.push(selectedAvatarIndex);
      }
      
      // 새로운 학생 수로 배열 초기화
      availableAvatars = [...Array(newCount).keys()];
      prevSelectedStudents = [];
      selectedAvatarIndex = -1;
      
      // 캐러셀 재초기화
      initializeCarousel();
      
      // 이전에 선택된 학생들이 새로운 범위 내에 있다면 다시 추가
      currentSelected.forEach(index => {
        if (index < newCount) {
          const indexToRemove = availableAvatars.indexOf(index);
          if (indexToRemove !== -1) {
            availableAvatars.splice(indexToRemove, 1);
            prevSelectedStudents.push(index);
          }
        }
      });
      
      // 모든 아바타 박스 다시 표시
      const avatarBoxes = document.querySelectorAll('.avatar-box');
      avatarBoxes.forEach(box => {
        box.classList.remove('hidden');
      });
    } else {
      alert('1에서 50 사이의 숫자를 입력해주세요.');
      studentCountInput.value = availableAvatars.length;
    }
  });

  // 스위치 토글 기능
  const switchElement = document.getElementById('resetSwitch');
  let deletePreviousSelections = false;
  
  if (switchElement) {
    switchElement.addEventListener('change', function() {
      deletePreviousSelections = this.checked;
    });
  }

  // 체크박스 활성화/비활성화 함수
  function toggleResetSwitch(enabled) {
    if (switchElement) {
      switchElement.disabled = !enabled;
      
      // 비활성화 시 시각적 표시를 위한 스타일 추가
      const switchLabel = switchElement.closest('.switch');
      if (switchLabel) {
        if (enabled) {
          switchLabel.classList.remove('disabled');
        } else {
          switchLabel.classList.add('disabled');
        }
      }
    }
  }

  // 배열을 무작위로 섞는 함수 (Fisher-Yates 알고리즘)
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // 더 강화된 랜덤 함수 (여러 소스의 랜덤성 결합)
  function getEnhancedRandom(max) {
    // 여러 랜덤 소스를 결합
    const r1 = Math.random();
    const r2 = Math.random();
    const r3 = Math.random();
    
    // 현재 시간의 밀리초를 사용하여 추가 랜덤성 부여
    const timeRandom = (Date.now() % 1000) / 1000;
    
    // 여러 랜덤 값을 조합 (가중치 부여)
    const combinedRandom = (r1 * 0.4 + r2 * 0.3 + r3 * 0.2 + timeRandom * 0.1) % 1;
    
    return Math.floor(combinedRandom * max);
  }

  // 모든 애니메이션 정지 함수
  function stopAllAnimations() {
    if (animationInterval) {
      cancelAnimationFrame(animationInterval);
      animationInterval = null;
    }
    
    if (lotteryAnimationId) {
      cancelAnimationFrame(lotteryAnimationId);
      lotteryAnimationId = null;
    }
    
    carouselRunning = false;
  }

  // 캐러셀 초기화 및 아바타 생성
  function initializeCarousel() {
    carouselElement.innerHTML = '';
    
    // 아바타 순서를 무작위로 배열
    const shuffledIndices = shuffleArray([...Array(availableAvatars.length).keys()]);
    
    // 초기 위치를 랜덤하게 설정 (1-10 사이의 랜덤한 위치에서 시작)
    const randomStartPosition = Math.floor(Math.random() * 10);
    
    // 40개의 아바타 박스 생성 (20개의 아바타를 2번 반복하여 무한 스크롤 효과)
    for (let i = 0; i < 40; i++) {
      const indexInShuffled = (i + randomStartPosition) % availableAvatars.length; // 랜덤한 시작 위치 적용
      const realIndex = shuffledIndices[indexInShuffled]; // 섞인 배열에서 인덱스 가져오기
      const avatarIndex = realIndex % avatarImages.length; // 5개의 이미지를 번갈아 사용
      
      const avatarBox = document.createElement('div');
      avatarBox.className = 'avatar-box';
      avatarBox.dataset.index = realIndex;
      avatarBox.dataset.number = realIndex + 1; // 번호를 데이터 속성으로 저장
      
      const avatarImg = document.createElement('img');
      avatarImg.src = avatarImages[avatarIndex];
      avatarImg.className = 'avatar-img';
      
      const avatarNumber = document.createElement('div');
      avatarNumber.className = 'avatar-number';
      avatarNumber.textContent = realIndex + 1;
      
      avatarBox.appendChild(avatarImg);
      avatarBox.appendChild(avatarNumber);
      carouselElement.appendChild(avatarBox);
    }
    
    // 캐러셀 초기 위치 설정 (초기 위치도 약간 랜덤하게)
    const randomOffset = (Math.random() * 20) - 10; // -10px ~ +10px 사이의 랜덤 오프셋
    carouselElement.style.transform = `translateX(${randomOffset}px)`;
  }

  // 캐러셀 무한 순환 애니메이션
  function startCarouselLoop() {
    // 이미 실행 중이면 중복 실행 방지
    if (carouselRunning) return;
    
    carouselRunning = true;
    
    const boxWidth = document.querySelector('.avatar-box').offsetWidth + 20; // 20px는 마진 값
    let position = parseFloat(getComputedStyle(carouselElement).transform.split(',')[4]) || 0;
    let lastTimestamp = 0;
    
    // 애니메이션 프레임 함수
    function animateLoop(timestamp) {
      // 애니메이션이 중지되었으면 실행하지 않음
      if (!carouselRunning || isSpinning) {
        animationInterval = null;
        return;
      }
      
      if (!lastTimestamp) lastTimestamp = timestamp;
      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      
      // 속도에 약간의 변화를 주어 더 자연스럽게
      const speedVariation = (Math.sin(timestamp * 0.001) * 0.5) + 1;
      const adjustedSpeed = normalSpeed * speedVariation;
      
      // 일정 속도로 오른쪽으로 이동
      position -= adjustedSpeed;
      
      // 무한 스크롤 효과: 한 아바타가 완전히 화면에서 사라지면 왼쪽에서 새로운 아바타가 나타남
      if (position <= -boxWidth) {
        // 한 아바타가 완전히 왼쪽으로 사라진 경우
        position += boxWidth; // 위치 재조정
        
        // 순환 효과: 오른쪽으로 사라진 아바타를 왼쪽에 추가
        const firstChild = carouselElement.firstElementChild;
        carouselElement.appendChild(firstChild);
        
        // 아바타 박스의 번호 유지
        const lastChild = carouselElement.lastElementChild;
        const numberElement = lastChild.querySelector('.avatar-number');
        if (numberElement) {
          numberElement.textContent = lastChild.dataset.number;
        }
      }
      
      carouselElement.style.transform = `translateX(${position}px)`;
      
      // 다음 프레임 요청 (캐러셀이 실행 중이고 뽑기 중이 아닌 경우에만)
      if (carouselRunning && !isSpinning) {
        animationInterval = requestAnimationFrame(animateLoop);
      } else {
        animationInterval = null;
      }
    }
    
    // 이전 애니메이션이 있으면 취소
    if (animationInterval) {
      cancelAnimationFrame(animationInterval);
      animationInterval = null;
    }
    
    // 애니메이션 시작
    animationInterval = requestAnimationFrame(animateLoop);
  }

  // 뽑기 버튼 클릭 이벤트
  selectButton.addEventListener('click', startLottery);

  // 추첨 시작 함수
  function startLottery() {
    if (isSpinning) return; // 이미 애니메이션 중이면 중복 실행 방지
    
    // 이전에 선택된 아바타 강조 제거
    const previousSelectedAvatars = document.querySelectorAll('.avatar-box.selected');
    previousSelectedAvatars.forEach(box => {
      box.classList.remove('selected');
    });
    
    isSpinning = true;
    carouselRunning = false; // 캐러셀 애니메이션 정지
    
    // 체크박스 비활성화
    toggleResetSwitch(false);
    
    // 모든 애니메이션 정지
    stopAllAnimations();
    
    // 이전에 선택된 학생 처리
    if (deletePreviousSelections && selectedAvatarIndex !== -1) {
      // 이전에 선택된 학생을 배열에서 제거
      const indexToRemove = availableAvatars.indexOf(selectedAvatarIndex);
      if (indexToRemove !== -1) {
        availableAvatars.splice(indexToRemove, 1);
        prevSelectedStudents.push(selectedAvatarIndex);
        
        // 스위치가 켜져있을 때만 화면에서 선택된 학생 제거
        if (deletePreviousSelections) {
          const avatarBoxes = document.querySelectorAll('.avatar-box');
          avatarBoxes.forEach(box => {
            if (parseInt(box.dataset.index) === selectedAvatarIndex) {
              box.classList.add('hidden');
            }
          });
        }
      }
      
      // 모든 학생이 선택되었으면 초기화
      if (availableAvatars.length === 0) {
        availableAvatars = [...prevSelectedStudents];
        prevSelectedStudents = [];
        // 모든 아바타 박스 다시 표시
        const avatarBoxes = document.querySelectorAll('.avatar-box');
        avatarBoxes.forEach(box => {
          box.classList.remove('hidden');
        });
        initializeCarousel();
      }
    }
    
    // 랜덤하게 학생 선택 (이미 선택된 학생은 제외) - 강화된 랜덤 함수 사용
    const randomIndex = getEnhancedRandom(availableAvatars.length);
    selectedAvatarIndex = availableAvatars[randomIndex];
    
    // 추첨 애니메이션 시작
    runLotteryAnimation();
  }
  
  // 추첨 애니메이션 실행 함수
  function runLotteryAnimation() {
    const boxWidth = document.querySelector('.avatar-box').offsetWidth + 20; // 20px는 마진 값
    const containerElement = document.querySelector('.depth-4-frame-6');
    const containerWidth = containerElement.offsetWidth;
    
    // 4단계로 나눈 애니메이션
    // 1단계: 빠른 가속 (0.5초)
    const phase1 = 500;
    // 2단계: 첫 번째 감속 (2초)
    const phase2 = 2000;
    // 3단계: 두 번째 감속 (4초)
    const phase3 = 4000;
    // 4단계: 매우 느린 최종 감속 (10초)
    const phase4 = 10000;
    
    // 총 애니메이션 시간
    const TOTAL_ANIMATION_TIME = phase1 + phase2 + phase3 + phase4;
    
    let startTime = null;
    let position = parseFloat(getComputedStyle(carouselElement).transform.split(',')[4]) || 0;
    
    // 속도 설정 (픽셀/프레임)
    const baseSpeed = normalSpeed;
    const maxSpeed = baseSpeed * 50; // 최대 속도 (속력 100)
    const midSpeed = baseSpeed * 25;  // 중간 속도 (속력 50)
    const lowSpeed = baseSpeed * 10;  // 낮은 속도 (속력 20)
    let currentSpeed = baseSpeed;
    
    // 랜덤 요소 추가: 최종 멈출 위치에 약간의 변화 추가 (특정 학생이 항상 중앙에 오지 않도록)
    const randomStopOffset = (Math.random() * boxWidth * 0.8) - (boxWidth * 0.4); // 박스 너비의 -40% ~ +40% 랜덤 오프셋
    
    // 애니메이션 완료 플래그
    let animationCompleted = false;
    
    // 애니메이션 프레임 함수
    function animateFrame(timestamp) {
      // 애니메이션이 이미 완료되었으면 더 이상 진행하지 않음
      if (animationCompleted) {
        return;
      }
      
      if (!startTime) startTime = timestamp;
      const elapsedTime = timestamp - startTime;
      
      if (elapsedTime < phase1) {
        // 1단계: 매우 빠른 가속 (0.5초)
        const progress = elapsedTime / phase1;
        // 가속 곡선에 easeInQuad 적용
        const easeInQuad = progress * progress;
        currentSpeed = baseSpeed + ((maxSpeed - baseSpeed) * easeInQuad);
      } else if (elapsedTime < phase1 + phase2) {
        // 2단계: 첫 번째 감속 (2초, 속력 100 -> 50)
        const progress = (elapsedTime - phase1) / phase2;
        // 감속 곡선에 easeOutCubic 적용
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        currentSpeed = maxSpeed - ((maxSpeed - midSpeed) * easeOutCubic);
      } else if (elapsedTime < phase1 + phase2 + phase3) {
        // 3단계: 두 번째 감속 (4초, 속력 50 -> 20)
        const progress = (elapsedTime - phase1 - phase2) / phase3;
        // 감속 곡선에 easeInOutQuad 적용
        const easeInOutQuad = progress < 0.5 
          ? 2 * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        currentSpeed = midSpeed - ((midSpeed - lowSpeed) * easeInOutQuad);
      } else if (elapsedTime < TOTAL_ANIMATION_TIME) {
        // 4단계: 매우 느린 최종 감속 (10초, 속력 20 -> 0)
        const progress = (elapsedTime - phase1 - phase2 - phase3) / phase4;
        
        // 특수 곡선 적용 - 긴장감 있는 느린 감속 효과
        // 시작은 선형적이지만 마지막에 더 오래 걸리는 효과
        let easingProgress;
        
        if (progress < 0.4) {
          // 처음 40%는 속도 20에서 10까지 빠르게 감속 (이전 70%에서 40%로 줄임)
          easingProgress = progress / 0.4 * 0.5; // 절반만 속도 감소
        } else {
          // 마지막 60%는 속도 10에서 0까지 극도로 느리게 감속 (이전 30%에서 60%로 늘림)
          const tailProgress = (progress - 0.4) / 0.6;
          // easeOutExpo 곡선으로 마무리 (더 극적인 효과를 위해 easeOutQuint에서 변경)
          const easeOutExpo = tailProgress === 1 ? 1 : 1 - Math.pow(2, -10 * tailProgress);
          easingProgress = 0.5 + (0.5 * easeOutExpo);
        }
        
        currentSpeed = lowSpeed * (1 - easingProgress);
      } else {
        // 애니메이션 완료, 회전 정지
        animationCompleted = true; // 애니메이션 완료 플래그 설정
        lotteryAnimationId = null; // 애니메이션 ID 초기화
        
        // 중앙에 가장 가까운 아바타 찾기
        const avatarBoxes = document.querySelectorAll('.avatar-box');
        const containerRect = containerElement.getBoundingClientRect();
        
        // 중앙 위치에 랜덤 오프셋 적용 (매번 다른 위치에서 선택되도록)
        const containerCenter = containerRect.left + containerRect.width / 2 + randomStopOffset;
        
        let closestBox = null;
        let minDistance = Infinity;
        
        avatarBoxes.forEach(box => {
          const boxRect = box.getBoundingClientRect();
          const boxCenter = boxRect.left + boxRect.width / 2;
          const distance = Math.abs(boxCenter - containerCenter);
          
          if (distance < minDistance) {
            minDistance = distance;
            closestBox = box;
          }
        });
        
        // 선택된 아바타 강조 및 인덱스 업데이트
        if (closestBox) {
          selectedAvatarIndex = parseInt(closestBox.dataset.index);
          
          // 인접한 아바타 선택 효과
          avatarBoxes.forEach(box => {
            if (parseInt(box.dataset.index) === selectedAvatarIndex) {
              box.classList.add('selected');
              // 선택된 아바타의 번호 색상 변경
              const numberElement = box.querySelector('.avatar-number');
              if (numberElement) {
                numberElement.style.color = '#FFD700'; // 금색으로 변경
                numberElement.style.fontWeight = 'bold';
              }
            } else {
              box.classList.remove('selected');
            }
          });
        }
        
        isSpinning = false;
        
        // 체크박스 다시 활성화
        toggleResetSwitch(true);
        
        // 캐러셀 애니메이션 재시작 코드 제거 - 애니메이션이 멈춘 상태로 유지
        // 캐러셀이 멈춘 상태를 유지
        carouselRunning = false;
        normalSpeed = baseSpeed;
        
        // 애니메이션이 완료되었으므로 requestAnimationFrame 호출 중단
        return;
      }
      
      // 위치 이동
      position -= currentSpeed;
      
      // 무한 스크롤 효과: 한 아바타가 완전히 화면에서 사라지면 왼쪽에서 새로운 아바타가 나타남
      if (position <= -boxWidth) {
        // 한 아바타가 완전히 왼쪽으로 사라진 경우
        position += boxWidth; // 위치 재조정
        
        // 순환 효과: 오른쪽으로 사라진 아바타를 왼쪽에 추가
        const firstChild = carouselElement.firstElementChild;
        carouselElement.appendChild(firstChild);
      }
      
      carouselElement.style.transform = `translateX(${position}px)`;
      
      // 다음 프레임 요청 (애니메이션이 완료되지 않은 경우에만)
      if (!animationCompleted) {
        lotteryAnimationId = requestAnimationFrame(animateFrame);
      }
    }
    
    // 애니메이션 시작
    lotteryAnimationId = requestAnimationFrame(animateFrame);
  }

  // 스타일 추가
  const style = document.createElement('style');
  style.textContent = `
    .switch.disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .switch.disabled .slider {
      background-color: #ccc;
    }
    .avatar-box.selected {
      animation: blink 1s ease-in-out 1;
      box-shadow: 0 0 10px 5px rgba(255, 215, 0, 0.7);
    }
    @keyframes blink {
      0% { box-shadow: 0 0 10px 5px rgba(255, 215, 0, 0.7); }
      50% { box-shadow: 0 0 15px 8px rgba(255, 215, 0, 1); }
      100% { box-shadow: 0 0 10px 5px rgba(255, 215, 0, 0.7); }
    }
  `;
  document.head.appendChild(style);

  // 초기화 함수 호출
  initializeCarousel();
  carouselRunning = true;
  startCarouselLoop();
}); 