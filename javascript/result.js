let type;
let scene;
let alcohol;
let db;
let preserved_recipes = [];        // 保存したレシピの配列
let preserved_images = [];         // 保存した画像の配列

const pres_button = document.getElementById("pres-btn");
const print_button = document.getElementById("print-btn");
const imgContainer = document.getElementById("image-container");
const imgFile = document.getElementById("img_file");
const imgPreview = document.getElementById("preview");

//結果を表示
const display_result = () => {
    let name = sessionStorage.getItem("name");
    if(!name){
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth()+1;
        const date = now.getDate();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const second = now.getSeconds();
        name = year + "/" + month + "/" + date + " " + hour + ":" + minute + ":" + second;
    }

    const name_result = document.getElementById("name_result");
    name_result.textContent = name;

    type = sessionStorage.getItem("type");
    const type_result = document.getElementById("type_result");
    type_result.textContent = type == "soda" ? "★タイプ: 固形せっけん" : "★タイプ: 液体せっけん";

    const alkali = sessionStorage.getItem("alkali");
    const alkali_result = document.getElementById("alkali_result");
    alkali_result.textContent = alkali;
                  
    const oil_amount_sum = sessionStorage.getItem("oilAmountSum"); 
    const oil_amount_sum_result = document.getElementById("oil_amount_sum_result");
    oil_amount_sum_result.textContent = oil_amount_sum;

    display_oils();
    display_options();

    const water_amount = sessionStorage.getItem("waterAmount");
    const water_amount_result = document.getElementById("water_amount_result");
    water_amount_result.textContent = water_amount;

    const alcohol_amount_result =  document.getElementById("alcohol_amount_result");
    if(type == "potash"){
        const alcohol_amount = sessionStorage.getItem("alcoholAmount");
        const text = alcohol_amount;
        alcohol_amount_result.textContent = text;
        alcohol = text;
    } else if(type == "soda") {
        alcohol_amount_result.style.display = "none";
    }

    display_features();
    display_conditions();

    if(scene == "result"){
        pres_button.style.display = "block";
        print_button.style.display = "none";
        imgContainer.style.display = "none";
    }
    else if(scene == "preserve"){
        pres_button.style.display = "none";
        print_button.style.display = "block";
        imgContainer.style.display = "block";

        if(preserved_recipes.length > 0) {
            const id = Number(sessionStorage.getItem("id"));
            const recipe = preserved_recipes.find(recipe => recipe.id == id);

            if(recipe) {
                loadImage(recipe.id).then((imageData) => {
                    imgPreview.src = imageData || "../assets/image/default.jpg";
                }).catch((error) => {
                    alert("エラー: " + error);
                });
            }
        }

        imgFile.addEventListener("change", (e) => {
            const file = e.target.files[0];
            let result;
            if(file){
                const reader = new FileReader();

                reader.onload = function(event){
                    const img = new Image();
                    img.src = event.target.result;

                    img.onload = function(){
                        const canvas = document.createElement("canvas");
                        const ctx = canvas.getContext("2d");

                        const maxWidth = 300; // サムネイルの最大幅
                        const scale = maxWidth / img.width;
                        canvas.width = maxWidth;
                        canvas.height = img.height * scale;

                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                        const thumbnailData = canvas.toDataURL("image/jpeg", 0.8); // 圧縮率80%
                
                        // IndexedDBに保存
                        if(!db) {
                            alert("IndexedDBを利用できません");
                            return;
                        }

                        const transaction = db.transaction("images", "readwrite");
                        const store = transaction.objectStore("images");
                        const recipeId = Number(sessionStorage.getItem("id"));
                        const putRequest = store.put({ id: recipeId, imageData: thumbnailData });

                        // プレビューに表示
                        imgPreview.src = thumbnailData;

                        putRequest.onsuccess = async function() {
                            await showLoading(imgPreview, 500);
                            alert("画像を保存しました");
                        };

                        putRequest.onerror = function() {
                            alert("画像を保存できませんでした");
                        };
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    display_memo();

}

// 各数値の確認
function collectWarnings() {
  const warnings = [];
  const waterAmount = parseFloat(sessionStorage.getItem("waterAmount").replace(/[^\d.]/g, "")) || 0;
  const oilSum = parseFloat(sessionStorage.getItem("oilAmountSum").replace(/[^\d.]/g, "")) || 0;
  const alcoholPurity = Number(sessionStorage.getItem("alcoholRatio")) || 0;
  const sapRatio = Number(sessionStorage.getItem("sapRatio")) || 0;
  const alkaliPurity = Number(sessionStorage.getItem("alkaliRatio")) || 0;
  const conditions = sessionStorage.getItem("conditions").split(",");
  const pH = Number(conditions[3]);

  const waterRatio = Math.floor(Number(waterAmount) / Number(oilSum) * 100);

  if(type === "soda" && waterRatio && (waterRatio < 25 || waterRatio > 45)) {
    warnings.push("水分量が不安定です (推奨25～45%)");
  }
  if(oilSum < 50 || oilSum > 1500) {
    warnings.push("油脂量が極端です (推奨50～1500g)");
  }
  if(type === "potash" && alcoholPurity < 0.9) {
    warnings.push("アルコールの純度が低すぎます (推奨90%以上)");
  }
  if(type === "soda" && (sapRatio < 0.8 || sapRatio > 1.0)) {
    warnings.push("鹸化率が不安定です (固形せっけんの場合は80～100%)");
  }
  if(type === "potash" && (sapRatio < 0.95 || sapRatio > 1.1)) {
    warnings.push("鹸化率が不安定です (液体せっけんの場合は95～110%)");
  }
  if(alkaliPurity < 0.85) {
    warnings.push("アルカリの純度が低すぎます (推奨85%以上)");
  }
  if (pH > 10.5) {
    warnings.push("pHが高すぎます（刺激が強くなる可能性があります）");
  } else if (pH < 8.0) {
    warnings.push("pHが低すぎます（鹸化が不十分になる可能性があります）");
  }

  return warnings;
}

// 選択された油脂の抽出
function getSelectedOilNames() {
    const rawList = JSON.parse(sessionStorage.getItem("oilNames") || "[]");

    return rawList
        .map(str => {
            // 「・油脂名 数字g (%)」から油脂名だけ抽出
            const match = str.match(/^・(.+?)\s\d+g\s\(\d+%?\)$/);
            return match ? match[1].trim() : null;
        })
        .filter(name => name && name !== "0g"); // nullや空文字を除外
}

function normalizeOilName(name) {
    return name
        .replace(/・/g, "")         // 頭の・を除去
        .replace(/\s/g, "")         // 全角・半角スペース除去
        .replace(/[［\[]/, "[")     // 全角 [
        .replace(/[］\]]/, "]");    // 全角 ]
}

// 油脂の組み合わせに関する確認
function evaluateOilGroups(oilNames) {
    const groupCount = {
        saturated: 0,
        mono: 0,
        poly: 0,
        special: 0,
        neutral: 0
    };

    oilNames.forEach(name => {
        const normalized = normalizeOilName(name);
        for (const group in window.OilGroups) {
            if (window.OilGroups[group].includes(normalized)) {
                groupCount[group]++;
                break;
            }
        }
    });

    const warnings = [];

    // 不飽和脂肪酸が多く、飽和脂肪酸がゼロ
    if (groupCount.poly >= 3 && groupCount.saturated === 0) {
        warnings.push("不飽和脂肪酸が多く、酸化しやすい構成です（飽和脂肪酸が不足）");
    }

    // 飽和脂肪酸がゼロ
    if (groupCount.saturated === 0) {
        warnings.push("泡立ちが弱くなる可能性があります（飽和脂肪酸が含まれていません）");
    }

    // 特殊油脂が多すぎる
    if (groupCount.special >= 2) {
        warnings.push("特殊油脂が多く、泡立ちや硬さが不安定になる可能性があります");
    }

    // 飽和脂肪酸が多すぎる（硬すぎる石けんになる可能性）
    if (groupCount.saturated >= 4 && groupCount.poly === 0 && groupCount.mono === 0) {
        warnings.push("飽和脂肪酸が多すぎるため、硬くて乾燥しやすい石けんになる可能性があります");
    }

    return warnings;
}

// 注意の表示
function showAlert(warnings) {
  const warningList = document.getElementById("warningList");

  warningList.innerHTML = "";
  warnings.forEach(w => {
    const li = document.createElement("li");
    li.textContent = w;
    warningList.appendChild(li);
  });

  document.getElementById("warningOverlay").classList.remove("hidden");
}

document.getElementById("closeWarning").onclick = () => {
  document.getElementById("warningOverlay").classList.add("hidden");
  document.getElementById("warningToggle").classList.remove("hidden");
};

document.getElementById("warningToggle").onclick = () => {
  document.getElementById("warningOverlay").classList.remove("hidden");
  document.getElementById("warningToggle").classList.add("hidden");
};

// 選択した油脂の表示
const display_oils = () => {
    const oil_names = JSON.parse(sessionStorage.getItem("oilNames") || "[]");
    //const oil_names = oil_names_json.split(",");
    const oil_name1  = oil_names[0];
    const oil_name2  = oil_names[1];
    const oil_name3  = oil_names[2];
    const oil_name4  = oil_names[3];
    const oil_name5  = oil_names[4];
    const oil_name6  = oil_names[5];
    const oil_name7  = oil_names[6];
    const oil_name8  = oil_names[7];
    const oil_name9  = oil_names[8];
    const oil_name10 = oil_names[9];

    if(oil_name1 == "・ 0g (0%)"){
        const oil_amount_result1 = document.getElementById("oil_amount_result1");
        oil_amount_result1.style.display = "none";
    }
    else{
        const oil_amount_result1 = document.getElementById("oil_amount_result1");
        oil_amount_result1.textContent = oil_name1;
    }

    if(oil_name2 == "・ 0g (0%)"){
        const oil_amount_result2 = document.getElementById("oil_amount_result2");
        oil_amount_result2.style.display = "none";
    }
    else{
        const oil_amount_result2 = document.getElementById("oil_amount_result2");
        oil_amount_result2.style.display = "inline-block";
        oil_amount_result2.textContent = oil_name2;
    }

    if(oil_name3 == "・ 0g (0%)"){
        const oil_amount_result3 = document.getElementById("oil_amount_result3");
        oil_amount_result3.style.display = "none";
    }
    else{
        const oil_amount_result3 = document.getElementById("oil_amount_result3");
        oil_amount_result3.style.display = "inline-block";
        oil_amount_result3.textContent = oil_name3;
    }

    if(oil_name4 == "・ 0g (0%)"){
        const oil_amount_result4 = document.getElementById("oil_amount_result4");
        oil_amount_result4.style.display = "none";
    }
    else{
        const oil_amount_result4 = document.getElementById("oil_amount_result4");
        oil_amount_result4.style.display = "inline-block";
        oil_amount_result4.textContent = oil_name4;
    }

    if(oil_name5 == "・ 0g (0%)"){
        const oil_amount_result5 = document.getElementById("oil_amount_result5");
        oil_amount_result5.style.display = "none";
    }
    else{
        const oil_amount_result5 = document.getElementById("oil_amount_result5");
        oil_amount_result5.style.display = "inline-block";
        oil_amount_result5.textContent =  oil_name5;
    }

    if(oil_name6 == "・ 0g (0%)"){
        const oil_amount_result6 = document.getElementById("oil_amount_result6");
        oil_amount_result6.style.display = "none";
    }
    else{
        const oil_amount_result6 = document.getElementById("oil_amount_result6");
        oil_amount_result6.style.display = "inline-block";
        oil_amount_result6.textContent = oil_name6;
    }

    if(oil_name7 == "・ 0g (0%)"){
        const oil_amount_result7 = document.getElementById("oil_amount_result7");
        oil_amount_result7.style.display = "none";
    }
    else{
        const oil_amount_result7 = document.getElementById("oil_amount_result7");
        oil_amount_result7.style.display = "inline-block";
        oil_amount_result7.textContent = oil_name7;
    }

    if(oil_name8 == "・ 0g (0%)"){
        const oil_amount_result8 = document.getElementById("oil_amount_result8");
        oil_amount_result8.style.display = "none";
    }
    else{
        const oil_amount_result8 = document.getElementById("oil_amount_result8");
        oil_amount_result8.style.display = "inline-block";
        oil_amount_result8.textContent = oil_name8;
    }

    if(oil_name9 == "・ 0g (0%)"){
        const oil_amount_result9 = document.getElementById("oil_amount_result9");
        oil_amount_result9.style.display = "none";
    }
    else{
        const oil_amount_result9 = document.getElementById("oil_amount_result9");
        oil_amount_result9.style.display = "inline-block";
        oil_amount_result9.textContent = oil_name9;
    }

    if(oil_name10 == "・ 0g (0%)"){
        const oil_amount_result10 = document.getElementById("oil_amount_result10");
        oil_amount_result10.style.display = "none";
    }
    else{
        const oil_amount_result10 = document.getElementById("oil_amount_result10");
        oil_amount_result10.style.display = "inline-block";
        oil_amount_result10.textContent = oil_name10;
    }
}

const display_options = () => {
    const optionNames = sessionStorage.getItem("optionNames");
    if(!optionNames) return;

    const options = optionNames.split(",");
    for(let i = 1; i <= 4; i++){
        const option_text = document.getElementById(`option_amount_result${i}`);
        if(options[i-1] && options[i-1] != "") {
            option_text.textContent = options[i-1];
            option_text.style.display = "block";
        } else {
            option_text.style.display = "none";
        }
    }
};

const display_features = () => {
    const features_label = document.getElementById("features");
    features_label.textContent = "★せっけんの特徴";

    const additional_infos = sessionStorage.getItem("additionalInfos").split(",");

    const skin = additional_infos[0];
    const skin_result = document.getElementById("skin_result");
    skin_result.textContent = skin;

    const clean = additional_infos[1];
    const clean_result = document.getElementById("clean_result");
    clean_result.textContent = clean;
                    
    const foam = additional_infos[2];
    const foam_result = document.getElementById("foam_result");
    foam_result.textContent = foam;
                    
    const hard = additional_infos[3];
    const hard_result = document.getElementById("hard_result");
    hard_result.textContent = hard;
                    
    const collapse = additional_infos[4];
    const collapse_result = document.getElementById("collapse_result");
    collapse_result.textContent = collapse;
                    
    const stability = additional_infos[5];
    const stability_result = document.getElementById("stability_result");
    stability_result.textContent = stability;

    create_chart(skin, clean, foam, hard, collapse, stability)
}

const create_chart = (sk, cl, fo, ha, co, st) => {
    var chart_canvas = document.createElement("canvas");
    chart_canvas.id = "chart_canvas";

    const skin = Number(sk.replace(/[^0-9|"."]/g, ""));
    const clean = Number(cl.replace(/[^0-9|"."]/g, ""));
    const foam = Number(fo.replace(/[^0-9|"."]/g, ""));
    const hard = Number(ha.replace(/[^0-9|"."]/g, ""));
    const collapse = Number(co.replace(/[^0-9|"."]/g, ""));
    const stability = Number(st.replace(/[^0-9|"."]/g, ""));

    var chart = new Chart(chart_canvas, {
        type: 'radar',
                        
        data: {
            labels: ["肌適正", "洗浄力", "起泡力", "硬さ", "崩れにくさ", "安定性"],
            datasets: [{
                label: "結果",
                data: [skin, clean, foam, hard, collapse, stability],
                backgroundColor: "rgba(236, 12, 161, 0.5)",
                borderColor: "black",
                borderWidth: 2,
                pointRadius: 0,
            }],
        },

        options: {
            title: {
                display: true,
                text: "特徴",
                font: {
                    size: 25,
                },
            },
            responsive: true,
            maintainAspectRatio: true,
            plugins:{
                legend: {
                    display: false,
                },
            },
            scales: {
                r: {
                    min: 0,
                    max: 15,
                    ticks: {
                        beginAtZero: true,
                        stepSize: 3,
                        font: {
                            size: 18
                        },
                        backdropColor: "rgba(0, 0, 0, 0)"
                    },
                    pointLabels: {
                        font: {
                            size: 20
                        }
                    }
                }
            },
        }
    });

    let chart_canvas_container = document.getElementById("chart_canvas-container");
    chart_canvas_container.appendChild(chart_canvas);
}

const display_conditions = () => {
    const conditions = sessionStorage.getItem("conditions").split(",");

    const mix_temp = conditions[0];
    const cure_temp = conditions[1];
    const cure_humidity = conditions[2];
    const final_ph = conditions[3];

    document.getElementById("mix_temp_text").textContent = mix_temp;
    document.getElementById("cure_temp_text").textContent = cure_temp;
    document.getElementById("cure_humidity_text").textContent = cure_humidity;
    document.getElementById("final_ph_text").textContent = final_ph;
};

const loadImage = (id) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("images", "readonly");
        const store = transaction.objectStore("images");
        const getRequest = store.get(id);

        getRequest.onsuccess = function(e) {
            resolve(e.target.result ? e.target.result.imageData : "../assets/image/default.jpg");
        };

        getRequest.onerror = function() {
            reject("画像の取得に失敗しました");
        };
    });
};

const display_memo = () => {
    const memo_result = document.getElementById("memo_result");
    const memo = sessionStorage.getItem("memo");

    memo_result.textContent = memo;
}

const openIndexedDB = () => {
    scene = sessionStorage.getItem("scene") || "result";

    const request = indexedDB.open("SoapRecipeDB", 2);

    request.onupgradeneeded = function(e) {
        db = e.target.result;
        if(!db.objectStoreNames.contains("recipes")) {
            db.createObjectStore("recipes", { keyPath: "id", autoIncrement: true });
        }
        if(!db.objectStoreNames.contains("images")) {
            db.createObjectStore("images", { keyPath: "id", autoIncrement: true });
        }
    };

    request.onsuccess = function(e) {
        db = e.target.result;

        const transaction = db.transaction("recipes", "readonly");
        const recipeStore = transaction.objectStore("recipes");
        const recipeRequest = recipeStore.getAll();

        const imageTransaction = db.transaction("images", "readonly");
        const imageStore = imageTransaction.objectStore("images");
        const imageRequest = imageStore.getAll();

        recipeRequest.onsuccess = function() {
            preserved_recipes = recipeRequest.result;

            imageRequest.onsuccess = function() {
                preserved_images = imageRequest.result;

                if(scene == "preserve"){
                    const id = sessionStorage.getItem("id");

                    if(id) {
                        loadImage(id).then((imageData) => {
                            imgPreview.src = imageData || "../assets/image/default.jpg";
                         }).catch((error) => {
                            alert("エラー: " + error);
                        });
                    }
                }

                display_result();

                let warnings = collectWarnings();
                const selectedOilNames = getSelectedOilNames();
                const oilWarnings = evaluateOilGroups(selectedOilNames);
                warnings.push(...oilWarnings);

                if(warnings.length > 0) {
                    showAlert(warnings);
                }
            };
        };
    }

    request.onerror = function(e) {
        alert("IndexedDBの接続に失敗しました");
    };
};

function pres_result(){
    if(!db) {
        alert("IndexedDBが利用できません");
        return;
    }

    showLoader_result();
    const start = performance.now();

    const recipe_name = document.getElementById("name_result").textContent;
    const type = document.getElementById("type_result").textContent;
    const alkali = document.getElementById("alkali_result").textContent;
    const oil_amount_sum = document.getElementById("oil_amount_sum_result").textContent;
    const oil1 = document.getElementById("oil_amount_result1").textContent;
    const oil2 = document.getElementById("oil_amount_result2").textContent;
    const oil3 = document.getElementById("oil_amount_result3").textContent;
    const oil4 = document.getElementById("oil_amount_result4").textContent;
    const oil5 = document.getElementById("oil_amount_result5").textContent;
    const oil6 = document.getElementById("oil_amount_result6").textContent;
    const oil7 = document.getElementById("oil_amount_result7").textContent;
    const oil8 = document.getElementById("oil_amount_result8").textContent;
    const oil9 = document.getElementById("oil_amount_result9").textContent;
    const oil10 = document.getElementById("oil_amount_result10").textContent;
    const option1 = document.getElementById("option_amount_result1").textContent;
    const option2 = document.getElementById("option_amount_result2").textContent;
    const option3 = document.getElementById("option_amount_result3").textContent;
    const option4 = document.getElementById("option_amount_result4").textContent;
    const water_amount = document.getElementById("water_amount_result").textContent;
    const alcohol_amount = document.getElementById("alcohol_amount_result").textContent;
    const skin = document.getElementById("skin_result").textContent;
    const clean = document.getElementById("clean_result").textContent;
    const foam = document.getElementById("foam_result").textContent;
    const hard = document.getElementById("hard_result").textContent;
    const collapse = document.getElementById("collapse_result").textContent;
    const stability = document.getElementById("stability_result").textContent;
    const mix_temp = document.getElementById("mix_temp_text").textContent;
    const cure_temp = document.getElementById("cure_temp_text").textContent;
    const cure_humidity = document.getElementById("cure_humidity_text").textContent;
    const final_ph = document.getElementById("final_ph_text").textContent;
    const memo = sessionStorage.getItem("memo") || "";

    const pres_infos = {
        recipe_name,
        type,
        alkali,
        oil_amount_sum,
        oil1,
        oil2,
        oil3,
        oil4,
        oil5,
        oil6,
        oil7,
        oil8,
        oil9,
        oil10,
        option1,
        option2,
        option3,
        option4,
        alcohol,
        water_amount,
        alcohol_amount,
        skin,
        clean,
        foam,
        hard,
        collapse,
        stability,
        mix_temp,
        cure_temp,
        cure_humidity,
        final_ph,
        memo,
        isFavorite: false,
        created_at: new Date().toISOString(),
    };

    const transaction = db.transaction("recipes", "readwrite");
    const store = transaction.objectStore("recipes");
    const addRequest = store.add(pres_infos);

    addRequest.onsuccess = async function() {
        const elapsed = performance.now() - start;
        const minTime = 500;
        const remaining = minTime - elapsed;
        if(remaining > 0) await new Promise((r) => setTimeout(r, remaining));

        fadeOutLoader_result();
        alert("レシピを保存しました");
    };

    addRequest.onerror = async function() {
        const elapsed = performance.now() - start;
        const minTime = 500;
        const remaining = minTime - elapsed;
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

        fadeOutLoader_result();
        alert("レシピを保存できませんでした");
    };
}

// 印刷
const print_result = () => {
    window.print();
};

// 共有されたレシピの表示
function renderRecipe(recipe, editable = false) {
  if (!recipe) return;
alert("成功")
  // 名前（なければ生成）
  const name_result = document.getElementById("name_result");
  const name = recipe.name || (() => {
    const now = new Date();
    return `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
  })();
  name_result.textContent = name;

  // タイプ
  const type_result = document.getElementById("type_result");
  const type = recipe.type;
  type_result.textContent = type === "soda" ? "★タイプ: 固形せっけん" : "★タイプ: 液体せっけん";

  // アルカリ
  const alkali_result = document.getElementById("alkali_result");
  alkali_result.textContent = recipe.alkali || "";

  // 油量合計
  const oil_amount_sum_result = document.getElementById("oil_amount_sum_result");
  oil_amount_sum_result.textContent = recipe.oilAmountSum || "";

  // 水分量
  const water_amount_result = document.getElementById("water_amount_result");
  water_amount_result.textContent = recipe.waterAmount || "";

  // アルコール（液体せっけんのみ）
  const alcohol_amount_result = document.getElementById("alcohol_amount_result");
  if (type === "potash") {
    alcohol_amount_result.textContent = recipe.alcoholAmount || "";
  } else {
    alcohol_amount_result.style.display = "none";
  }

  // オイル・オプション・特徴・条件・メモなど
  display_oils(recipe.oils);
  display_options(recipe.options);
  display_features(recipe.features);
  display_conditions(recipe.conditions);
  display_memo(recipe.memo);

  // UI切り替え（QR共有は result モード）
  pres_button.style.display = "block";
  print_button.style.display = "none";
  imgContainer.style.display = "none";
}

window.onload = () => {
    if(shouldShowLoader_result()) {
        showLoader_result();
    }

    setTimeout(() => {
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: "smooth"
        });
    }, 0);

    const params = new URLSearchParams(location.search);
    const compressed = params.get("data");
    const editable = params.get("editable") === "true";

    if(compressed) {alert("compressed")
        try {
            const qrRecipe = JSON.parse(LZString.decompressFromEncodedURIComponent(compressed));
alert(editable);
            renderRecipe(qrRecipe, editable);
            fadeOutLoader_result();
        } catch(e) {
            alert("表示に失敗しました");
            location.href = "../html/list.html";
        }
        return;
    } else {
        openIndexedDB();
    }

    //openIndexedDB();

    fadeOutLoader_result();
}

const showLoading = (elm, duration = 500) => {
    elm.style.opacity = "0.5";
    elm.classList.add("loading");

    return new Promise((resolve) => {
        setTimeout(() => {
            elm.style.opacity = "1";
            elm.classList.remove("loading");
            resolve();
        }, duration);
    });
};

const shouldShowLoader_result = () => {
    const logo = document.querySelector(".logo");
    return logo && !logo.complete;
};

const showLoader_result = () => {
    const loader = document.getElementById("loader");
    loader.style.display = "flex";
    loader.style.opacity = "1";
};

const fadeOutLoader_result = () => {
    const loader = document.getElementById("loader");
    loader.style.opacity = "0";
    setTimeout(() => {
        loader.style.display = "none";
    }, 300);
};
