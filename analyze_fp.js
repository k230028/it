const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const ilfScores = [];
let totalIlfScore = 0;

function getIlfScore(ret, det) {
    if(ret == 1) {
        if(det <= 50) return {level: 'Low', score: 7};
        return {level: 'Average', score: 10};
    } else if (ret >= 2 && ret <= 5) {
        if(det <= 19) return {level: 'Low', score: 7};
        if(det <= 50) return {level: 'Average', score: 10};
        return {level: 'High', score: 15};
    } else {
        if(det <= 19) return {level: 'Average', score: 10};
        return {level: 'High', score: 15};
    }
}

function analyzeEntities() {
  const srcPath = 'C:/it/it_backend/src/main/java';
  walkDir(srcPath, (filePath) => {
    if (filePath.endsWith('.java') && (filePath.includes('\\entity\\') || filePath.includes('/entity/'))) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('@Entity')) {
        const lines = content.split('\n');
        let detCount = 7; // BaseEntity inheritance
        let retCount = 1; 
        for(let line of lines) {
           if(line.trim().startsWith('private ')) detCount++;
           if(line.includes('@OneToMany') || line.includes('@Embedded') || line.includes('@ElementCollection')) retCount++;
        }
        
        const scoreData = getIlfScore(retCount, detCount);
        totalIlfScore += scoreData.score;
        ilfScores.push({ name: path.basename(filePath, '.java'), ret: retCount, det: detCount, level: scoreData.level, score: scoreData.score });
      }
    }
  });
}

const txScores = [];
let totalTxScore = 0;

function analyzeControllers() {
  const srcPath = 'C:/it/it_backend/src/main/java';
  walkDir(srcPath, (filePath) => {
    if (filePath.endsWith('.java') && (filePath.includes('\\controller\\') || filePath.includes('/controller/'))) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('@RestController') || content.includes('@Controller')) {
        const lines = content.split('\n');
        for(let line of lines) {
           if(line.includes('@GetMapping')) {
               // EQ - Assume FTR 1~2, DET 10 on average
               txScores.push({ controller: path.basename(filePath, '.java'), type: 'EQ', level: 'Low', score: 3 });
               totalTxScore += 3;
           } else if(line.includes('@PostMapping') || line.includes('@PutMapping') || line.includes('@DeleteMapping') || line.includes('@PatchMapping')) {
               // EI - Assume FTR 1~2, DET 10 on average
               txScores.push({ controller: path.basename(filePath, '.java'), type: 'EI', level: 'Low', score: 3 });
               totalTxScore += 3;
           }
        }
      }
    }
  });
}

analyzeEntities();
analyzeControllers();

const ufp = totalIlfScore + totalTxScore;
const vaf = 1.0; // Assume standard
const adjustedFp = ufp * vaf;
const fpUnitCost = 553100; // 2023 Korean Govt FP cost approximate target
const totalCost = adjustedFp * fpUnitCost * 1.1; // * 1.1 for VAT/Profit

let output = `# 정통법(Detailed FP) 기능점수 산정 결과 보고서\n\n`;
output += `## 1. 개요\n- **시스템:** IT Portal System (it_frontend, it_backend)\n- **산정 방식:** 정통법 (Detailed Function Point)\n\n`;

output += `## 2. 데이터 기능 (ILF) 산정 상세\n`;
output += `| 엔티티명 | RET | DET | 복잡도 | 기능점수(FP) |\n`;
output += `|----------|-----|-----|--------|--------------|\n`;
ilfScores.sort((a,b)=>b.score - a.score || b.det - a.det).forEach(item => {
    output += `| ${item.name} | ${item.ret} | ${item.det} | ${item.level} | ${item.score} |\n`;
});
output += `**데이터 기능 총점(ILF + EIF):** ${totalIlfScore} FP\n\n`;

output += `## 3. 트랜잭션 기능 (EI, EO, EQ) 산정 요약\n`;
output += `각 컨트롤러의 API 엔드포인트를 기준으로 트랜잭션 기능을 식별하였습니다. (평균 복잡도 Low 적용 기준)\n`;
let eiCount = txScores.filter(t=>t.type === 'EI').length;
let eqCount = txScores.filter(t=>t.type === 'EQ').length;
output += `- **외부입력 (EI):** ${eiCount}개 (예상 FP: ${eiCount * 3})\n`;
output += `- **외부조회/출력 (EQ/EO):** ${eqCount}개 (예상 FP: ${eqCount * 3})\n`;
output += `**트랜잭션 기능 총점:** ${totalTxScore} FP\n\n`;

output += `## 4. 최종 개발 비용 산정\n`;
output += `- **미조정 기능점수(UFP):** ${ufp} FP\n`;
output += `- **보정계수(VAF):** 1.00 (기본)\n`;
output += `- **보정 후 기능점수:** ${adjustedFp} FP\n`;
output += `- **FP당 단가:** ₩553,100 (정보처리학회/SW산업협회 참고단가)\n`;
output += `- **총 개발비용 (이윤 및 부가세 포함):** ₩${Math.round(totalCost).toLocaleString()}\n\n`;
output += `> [!NOTE]\n> 본 산정 결과는 백엔드 소스코드(Entity, Controller)를 기반으로 정통법 산정 기준을 시뮬레이션한 수치입니다. 화면 UI 복잡도 및 외부 인터페이스(EIF) 세부 사항에 따라 실제 산정 시 가감이 발생할 수 있습니다.\n`;

fs.writeFileSync('C:/it/docs/fp_estimation_report.md', output);
console.log('Report generated at C:/it/docs/fp_estimation_report.md');
