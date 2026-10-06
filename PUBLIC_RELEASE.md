# GitHub 공개 준비 안내

확인일: 2026-10-06. 이 파일은 배포 준비와 출처 확인 기록이며, 별도의 이용허락을 부여하는 라이선스가 아닙니다.

## 공개 전 남은 확인

**전국 비교에 포함된 과거 기상청 공개 엔드포인트 자료의 재배포 조건은 최종 확인이 필요합니다.** `national/history-data.js`, `national/data/history-20261003.json` 및 `.csv`는 기존 자료를 그대로 보존했습니다. 2026-10-03 14:32–15:32 KST의 `nph-aws_txt_min` 수동 조회 자료입니다. 일반 기상청 정책과 출처표시 안내는 확인했지만, 이 오래된 엔드포인트에 적용되는 개별 공공누리 유형을 이번 점검에서 확정하지 못했습니다. 금지되어 있다는 결론은 아닙니다.

공개하기 전에 해당 자료에 적용되는 공공누리 표시 또는 별도 재배포 허락을 확인하고 근거를 보관하세요. 표시를 확인할 수 없다면 [기상청 저작권 정책](https://www.weather.go.kr/kma/guide/copyright.jsp)에 따라 담당자에게 **이 엔드포인트에서 얻은 위 시간 범위의 ASOS·AWS 관측값을 정규화한 JSON/CSV와 브라우저 실행용 JS에 포함하여 공개 GitHub 저장소에 재배포할 수 있는지, 적용 유형은 무엇인지** 확인하면 됩니다. [기상자료개방포털 저작권 정책](https://data.kma.go.kr/cmmn/static/staticPage.do?page=pageCr)을 함께 참고하세요. 이 확인 없이 패키지 전체의 데이터 재배포 권리가 확정됐다고 설명하지 마세요.

## 이번에 준비한 사항

- 표준 첫 페이지 `index.html`, 상대경로 정적 자산, `.nojekyll`
- API 키·인증·빌드 과정 없이 저장 자료로 실행하는 구성
- 환경 파일·키 파일·개발 캐시·포털 HTML 캡처를 제외하는 `.gitignore`
- 세션 식별자가 포함된 포털 HTML 캡처 1개를 **이 공개용 묶음에서만 제외**. 실제 관측 CSV, 정규화 JSON/JS, 검증 결과는 보존
- `verification/public-release-exclusions.json`에 제외 사유·기존 해시·공식 출처 기록. 기존 데이터의 `rawFile`/`rawFiles` 경로는 과거 출처 기록이므로 해당 캡처가 묶음에 있다는 뜻이 아님
- 기존 보존 검사 기준은 유지하고 위 캡처 1개만 명시적으로 제외하여 비교. `tests/public-release.test.cjs`에 재유입·자격증명 패턴·개인 경로 점검 추가

`.gitignore`는 이미 커밋된 내용을 지우지 않습니다. 이전 작업 폴더나 예전 ZIP 전체를 함께 올리지 말고 이 묶음의 파일만 사용하세요. 이 점검은 탐지 패턴 기반이며 모든 형태의 비밀정보 부재를 보증하지 않습니다. 저장소 생성·푸시·GitHub Pages 활성화는 이 묶음 작성 과정에서 실행하지 않았습니다.

## 코드와 데이터의 이용조건 구분

프로젝트 코드의 재사용 라이선스는 아직 지정하지 않았습니다. 공개 저장소로 올리는 것과 오픈소스 라이선스를 부여하는 것은 별개입니다. 권리자가 원하는 코드 라이선스를 선택한 뒤 `LICENSE`로 추가할 수 있습니다. 이 준비 과정에서 MIT 등 특정 라이선스를 임의로 부여하지 않았습니다. [GitHub 라이선스 안내](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)

외부 데이터·지형·경계는 프로젝트 코드 라이선스에 일괄 포함하지 마세요.

- **기상청 관측값·관측소 이력:** 출처·관측일·원본 경로와 변환 설명은 `SOURCES.md`에 있습니다. 보존된 ASOS 포털 표본 페이지에는 출처표시 공공누리 표지가 확인되었습니다. [공식 종관관측 서비스 목록](https://www.data.go.kr/data/15139432/openapi.do)과 [관측지점정보 목록](https://www.data.go.kr/data/15139439/openapi.do)은 제1유형을 명시하지만, 다른 엔드포인트의 개별 조건을 자동으로 대신하지는 않습니다. [공공누리 제1유형](https://www.kogl.or.kr/info/licenseType1.do)은 출처와 가능한 경우 원문 링크를 유지하고 기관의 후원·보증으로 오인시키지 않도록 요구합니다
- **기상청 출처표시:** [2026-09-14 공식 안내](https://apihub.kma.go.kr/notice.do?seqNotice=57)는 2026-09-18 이후 기상기후데이터 및 활용정보의 공표·제3자 제공 시 출처표시 의무를 안내합니다. 이것만으로 모든 원자료의 재배포 허락을 증명하지는 않습니다
- **GEBCO_2024 지형 이미지:** `matrix/data/jeonbuk-gebco-2024-relief.png`와 파생 표시. [공식 조건](https://www.gebco.net/data-products/gridded-bathymetry/terms-of-use)은 복제·배포·가공을 허용하며 출처표시, 비보증·비공식성 유지와 오인 방지를 요구합니다. 항해·해상안전용으로 사용하지 마세요. `SOURCES.md`와 `matrix/data/terrain-provenance.json`의 판본·DOI를 유지하세요
- **SGIS 유래 행정경계:** `matrix/terrain.js`, `national/admin-data.js`. [vuski/admdongkor 원문](https://github.com/vuski/admdongkor/blob/master/LICENSE-DATA)의 CC BY 4.0 및 SGIS 출처표시를 유지하세요. `data/ADMIN-LICENSE.txt`, `data/admin-sources.json`에 이용조건과 가공 내역이 있습니다
- **Natural Earth 국가 윤곽:** `national/map-data.js`. [공식 이용조건](https://www.naturalearthdata.com/about/terms-of-use/)상 public domain입니다. 원본·추출·좌표 정리 설명과 “Made with Natural Earth” 표기를 유지합니다

이 시각화는 공식 예보·재난 경보·항공·해상 안전·측량용 서비스가 아닙니다. 숫자 유효성은 기상청 QC 통과를 뜻하지 않습니다. 전북과 전국 자료의 관측일은 다르며, 선과 움직임은 공기의 실제 이동 경로가 아닙니다.

## 확인 후 GitHub Pages로 올리는 방법

1. 위 자료 조건과 코드 라이선스 선택을 검토합니다
2. 이 폴더의 **내용 전체**를 저장소 루트에 넣습니다. `index.html`과 `.nojekyll`이 루트에 있어야 합니다
3. 저장소 Settings → Pages에서 배포 브랜치와 `/(root)`를 선택합니다. 별도 빌드나 API 비밀키는 필요 없습니다
4. 실제 발급된 Pages 주소에서 첫 화면, 관측소 화면, 전국 비교 화면과 각 페이지의 새로고침·뒤로가기를 확인합니다. 자동 검사와 실제 배포 확인은 별개입니다

공식 절차: [GitHub Pages 사이트 만들기](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site). 일반 프로젝트 저장소의 하위경로에서도 상대경로가 유지되도록 구성했으며, 실제 GitHub 주소로 배포한 검증은 아직 하지 않았습니다.

로컬 점검: Node.js가 있다면 `node --test tests/public-release.test.cjs`, `node verification/audit-preservation.cjs --verify . verification/baseline.json`을 이 폴더에서 실행할 수 있습니다. 전체 계산·화면 검사 범위는 `TEST_REPORT.md`를 보세요.
