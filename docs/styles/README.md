# 비전서 제작 규칙

비전서 하나는 아래 4가지를 한 세트로 만든다. 결과물은 `docs/styles/<id>/` 에 둔다.

| # | 결과물 | 파일 | 내용 |
|---|---|---|---|
| 1 | 기술 기본 이미지 | `stance.jpg` (+ `concept.png`) | 대기 자세와 캐릭터 특징 |
| 2 | 기술 동작 이미지 | `combo.jpg`, `combo_*.jpg` | 4~6컷 연속 동작 (게임 화면에서 캡처) |
| 3 | 콤보 커맨드 | `README.md` | 실제 게임 입력 키 조합 |
| 4 | 기술 설명 | `README.md` | 공격 범위, 피해, 경직, 띄우기·다운, 전진 거리 |

## 원칙

- **원작 데이터와 신규 설계를 구분한다.** 이 게임의 모션·커맨드·수치는 모두 신규 설계다. 원작에서 참고한 것은 "어떤 성격의 비전서인가" 하는 방향뿐이고, README에 그 출처를 따로 적는다.
- 원작의 캐릭터·모션·UI·이름표를 그대로 옮기지 않는다.
- 키 표기: `X` 손(P) · `C` 발(K) · `Z` 가드 · `V` 난무 · `Space` 점프.

## 만드는 순서

1. `src/anims.ts` — 대기 자세(`<id>_idle_Loop`)와 고유 모션
2. `src/moves.ts` — 기술(`MOVES`)과 비전서(`STYLES`), `OPEN_STYLES` 에 추가
3. `tools/test-rules.mjs` — 커맨드별 테스트
4. 이미지: `node tools/shot-style.mjs <id> docs/styles/<id>/combo.jpg '{"2":"J","18":"K"}' '[1,10,28]' 3`
   (첫 JSON = 틱별 입력 `J` 손 / `K` 발, 둘째 = 캡처할 틱, 마지막 = 열 수)
5. `docs/styles/<id>/README.md` 작성
