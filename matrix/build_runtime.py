"""Lossless runtime serialization of the verified dataset, with equality proof.
Wind values and raw tokens are not rounded, interpolated or invented.
"""
import pathlib,json,collections,datetime
BASE=pathlib.Path(__file__).resolve().parent
source=json.loads((BASE/'data/jeonbuk-20241006.json').read_text())
records=source['records']; groups=collections.defaultdict(list)
for record in records:groups[record['stationId']].append(record)
blocks=[]
for sid,rows in groups.items():
    first=rows[0];name=first['rawValues']['지점명'];first_line=first['sourceRow'];values=[]
    assert len(rows)==1439
    for i,r in enumerate(rows,1):
        clock=f'{i//60:02d}:{i%60:02d}'
        assert r['timestamp']==f'2024-10-06T{clock}:00+09:00'
        assert r['rawValues']['일시']==f'2024-10-06 {clock}'
        assert r['rawValues']['지점']==sid and r['rawValues']['지점명']==name
        assert r['sourceRow']==first_line+i-1
        assert r['sourceFile']==first['sourceFile'] and r['qcStatus']==first['qcStatus']
        direction=r['rawValues']['풍향(deg)'];speed=r['rawValues']['풍속(m/s)']
        assert not any(c in direction+speed for c in [',',';','\n'])
        assert (float(direction) if direction else None)==r['directionFromDeg']
        assert (float(speed) if speed else None)==r['speedMps']
        assert set(r)=={'stationId','timestamp','directionFromDeg','speedMps','rawValues','sourceRow','sourceFile','qcStatus'}
        assert set(r['rawValues'])=={'지점','지점명','일시','풍향(deg)','풍속(m/s)'}
        values.append(direction+','+speed)
    blocks.append([sid,name,first_line,first['sourceFile'],first['qcStatus'],';'.join(values)])
metadata={k:v for k,v in source.items() if k!='records'}
js='''/* Lossless serialization of the user's actual KMA wind CSV. Never synthetic. */
(function () {
  'use strict';
  const data = METADATA;
  const blocks = BLOCKS;
  data.records = [];
  for (const [stationId, name, firstLine, sourceFile, qcStatus, values] of blocks) {
    values.split(';').forEach((pair, index) => {
      const [fromToken, speedToken] = pair.split(',');
      const minute = index + 1;
      const timestamp = window.WindMatrixCore.timestampAt(minute);
      data.records.push({stationId, timestamp,
        directionFromDeg: fromToken === '' ? null : Number(fromToken),
        speedMps: speedToken === '' ? null : Number(speedToken),
        rawValues: {'지점':stationId,'지점명':name,'일시':timestamp.slice(0,10)+' '+timestamp.slice(11,16),'풍향(deg)':fromToken,'풍속(m/s)':speedToken},
        sourceRow:firstLine+index,sourceFile,qcStatus});
    });
  }
  window.WIND_MATRIX_DATA = data;
})();
'''.replace('METADATA',json.dumps(metadata,ensure_ascii=False,separators=(',',':'))).replace('BLOCKS',json.dumps(blocks,ensure_ascii=False,separators=(',',':')))
(BASE/'data/observed-data.js').write_text(js)
print(f'Lossless runtime source: {len(js.encode())} bytes, {len(records)} original records')
