# Moltiz-Maltiz-Store
Moltiz, Maltiz캐릭터를 이용한 쇼핑몰을 만들었습니다.


물품들을 store폴더안에 집어넣었습니다 . (각각 물품 html, css 전부), store폴더안에 Basket폴더안에 장바구니 (각각 해당 물품 html, css전부) 


하지만 물품을 늘리려면 html이 많아지기 때문에 store폴더안에 product.json을 만들어서 HTML/CSS는 그대로 두고 상품만 추가/수정할수있게 만들 계획이다.

다른 페이지(목록/상세/검색)에서 같은 데이터 재사용 가능
객체는 { }, 배열은 [ ]

키와 문자열은 반드시 큰따옴표 " " 사용

값 타입: 문자열, 숫자, true/false, null, 객체, 배열

끝에 콤마(, ) 금지, 주석 금지 (//, /* */ 안 됨)


Node.js(자바스크립트 런타임) 로 아주 작은 웹 API를 하나 띄우는 거야.
이 API가 DB에서 id로 상품을 찾아서 product.html/basketin.html이 그걸 받아 쓰는 구조!
그러면 상품id만 있으면 각각의 상품html을 만들 필요가 없다.

공용 상세: store/product.html?id=<상품ID>

공용 장바구니: store/basketin.html?id=<상품ID>&qty=1

하는법 1) 폴더 만들고 라이브러리 설치

mkdir api && cd api
npm init -y
npm i express cors  하지만 이미 server.js가있으니 

2) Api  check  

http://localhost:8080/api/ping → pong 나오면 OK (o)

http://localhost:8080/api/db-ping → { ok: true, rows: [...] } 나오면 DB 연결 OK

ECONNREFUSED 127.0.0.1:3306 는 서버가 MySQL에 붙지 못했다. =>코드스페이스는 PC가 아니고 1회용이기 때문 다운받은후 다시하면 {"ok":true,"rows":[{"ok":1}]} "ok": true, "rows": [ { "ok": 1 } ] } 가 나옴 => 데이터베이스 연결이 확인

3) 
테스트 순서
npm start 후 브라우저에 검색해보
…/api/products/4 → 지금처럼 JSON 잘 보이는지 확인

…/store/product.html?id=4 → 세일가/원가/이미지/배송비 표시 OK

…/store/basketin.html?id=4&qty=2 → 총액 계산 OK (무료배송이면 Free 표시)