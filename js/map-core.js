// 地図コア機能を管理するモジュール
import { DEFAULTS } from './constants.js';

export class MapCore {
    constructor() {
        this.initialCenter = DEFAULTS.MAP_CENTER;
        this.initialZoom = DEFAULTS.MAP_ZOOM;
        this.map = null;
        this.init();
    }

    async init() {
        
        // 地図の初期化
        this.map = L.map('map').setView(this.initialCenter, this.initialZoom);

        // スケールバーを右下に追加
        L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 150 }).addTo(this.map);

        // 国土地理院タイルレイヤー
        L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
            attribution: "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>地理院タイル</a>",
            minZoom: 2, maxZoom: 18
        }).addTo(this.map);

        // ドラッグハンドル用の専用ペインを作成
        this.map.createPane('dragHandles');
        this.map.getPane('dragHandles').style.zIndex = 650;

        // 中心マーカー用の専用ペインを作成
        this.map.createPane('centerMarker');
        this.map.getPane('centerMarker').style.zIndex = 700;

        // wayPointマーカー用の専用ペインを作成
        this.map.createPane('waypointMarkers');
        this.map.getPane('waypointMarkers').style.zIndex = 750;

        // 経路線用の専用ペインを作成
        this.map.createPane('routeLines');
        this.map.getPane('routeLines').style.zIndex = 600;
    }

    getMap() {
        return this.map;
    }

    getInitialCenter() {
        return this.initialCenter;
    }

    // 設定値を取得（後方互換性のため残す）
    getConfig() {
        // config.jsonは廃止されたため、nullを返す
        return null;
    }

    showErrorMessage(title, message) {
        const messageBox = document.createElement('div');
        messageBox.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border: 1px solid #ccc;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            border-radius: 8px;
            font-family: sans-serif;
            text-align: center;
        `;
        messageBox.innerHTML = `
            <h3>${title}</h3>
            <p>${message}</p>
            <button onclick="this.parentNode.remove()" style="
                padding: 8px 16px;
                margin-top: 10px;
                border: none;
                background-color: #007bff;
                color: white;
                border-radius: 4px;
                cursor: pointer;
            ">OK</button>
        `;
        document.body.appendChild(messageBox);
    }
}