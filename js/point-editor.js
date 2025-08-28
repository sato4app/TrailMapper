// ポイント編集機能を管理するモジュール
export class PointEditor {
    constructor(map, gpsData) {
        this.map = map;
        this.gpsData = gpsData;
        this.selectedAction = null;
        this.pointMarkers = [];
        this.tempCounter = 1; // 仮ナンバリング用カウンター
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // ポイント操作ボタンのイベントハンドラー設定
        const addPointBtn = document.getElementById('addPointBtn');
        const movePointBtn = document.getElementById('movePointBtn');
        const deletePointBtn = document.getElementById('deletePointBtn');

        if (addPointBtn) {
            addPointBtn.addEventListener('click', () => {
                this.toggleActionButton('add', addPointBtn);
            });
        }

        if (movePointBtn) {
            movePointBtn.addEventListener('click', () => {
                this.toggleActionButton('move', movePointBtn);
            });
        }

        if (deletePointBtn) {
            deletePointBtn.addEventListener('click', () => {
                this.toggleActionButton('delete', deletePointBtn);
            });
        }

        // 地図クリックイベント
        this.map.on('click', (e) => {
            this.onMapClick(e);
        });

        // フィールド更新イベント
        const pointIdField = document.getElementById('pointIdField');
        const locationField = document.getElementById('locationField');
        
        if (pointIdField) {
            pointIdField.addEventListener('input', () => {
                this.updateSelectedPointData();
            });
        }
        
        if (locationField) {
            locationField.addEventListener('input', () => {
                this.updateSelectedPointData();
            });
        }
    }

    toggleActionButton(action, buttonElement) {
        // 全てのボタンから選択状態を削除
        const allButtons = document.querySelectorAll('.point-action-btn');
        allButtons.forEach(btn => btn.classList.remove('selected'));

        // クリックしたボタンが現在選択されているボタンと同じ場合は未選択状態にする
        if (this.selectedAction === action) {
            this.selectedAction = null;
            this.updateMapCursor();
        } else {
            // 新しいボタンを選択状態にする
            this.selectedAction = action;
            buttonElement.classList.add('selected');
            this.updateMapCursor();
        }
    }

    updateMapCursor() {
        const mapContainer = this.map.getContainer();
        
        switch (this.selectedAction) {
            case 'add':
                mapContainer.style.cursor = 'crosshair';
                break;
            case 'move':
                mapContainer.style.cursor = 'move';
                this.updatePointsDraggable(true);
                break;
            case 'delete':
                mapContainer.style.cursor = 'pointer';
                this.updatePointsDraggable(false);
                break;
            default:
                mapContainer.style.cursor = '';
                this.updatePointsDraggable(false);
                break;
        }
    }

    onMapClick(e) {
        if (!this.selectedAction) {
            return;
        }

        switch (this.selectedAction) {
            case 'add':
                this.addPoint(e.latlng);
                break;
            // move と delete は個別のマーカーイベントで処理
        }
    }

    addPoint(latlng) {
        const pointIdField = document.getElementById('pointIdField');
        let pointId = pointIdField ? pointIdField.value.trim() : '';
        
        // ID名がブランクの場合、"仮nn"として登録
        if (!pointId) {
            pointId = `仮${this.tempCounter.toString().padStart(2, '0')}`;
            this.tempCounter++;
        }

        // 新しいポイントデータを作成
        const pointData = {
            id: pointId,
            lat: latlng.lat,
            lng: latlng.lng,
            location: '',
            elevation: null
        };

        // マーカーを作成
        const marker = this.createPointMarker(pointData);
        this.pointMarkers.push(marker);

        // GPS データに追加
        if (this.gpsData) {
            this.gpsData.addPoint(pointData);
        }

        // UI更新
        this.updatePointCountField();
        this.selectPoint(pointData, marker);

        // 追加モードを解除
        this.clearSelection();
    }

    createPointMarker(pointData) {
        // GPS三角形マーカーのアイコンを作成
        const triangleIcon = L.divIcon({
            className: 'gps-triangle-marker',
            html: `<div style="
                width: 0; 
                height: 0; 
                border-left: 8px solid transparent; 
                border-right: 8px solid transparent; 
                border-bottom: 16px solid #ff0000; 
                filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
            "></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 16],
            popupAnchor: [0, -16]
        });

        const marker = L.marker([pointData.lat, pointData.lng], { icon: triangleIcon })
            .addTo(this.map);

        // マーカークリックイベント
        marker.on('click', (e) => {
            e.originalEvent.stopPropagation();
            this.onMarkerClick(pointData, marker);
        });

        // ドラッグイベント
        marker.on('dragend', (e) => {
            const newLatLng = e.target.getLatLng();
            pointData.lat = newLatLng.lat;
            pointData.lng = newLatLng.lng;
            this.updatePointInfo(pointData);
            if (this.gpsData) {
                this.gpsData.updatePoint(pointData);
            }
        });

        // マーカーにポイントデータを関連付け
        marker.pointData = pointData;

        return marker;
    }

    onMarkerClick(pointData, marker) {
        if (this.selectedAction === 'delete') {
            this.deletePoint(pointData, marker);
        } else {
            this.selectPoint(pointData, marker);
        }
    }

    selectPoint(pointData, marker) {
        this.selectedPoint = pointData;
        this.selectedMarker = marker;
        this.updatePointInfo(pointData);
    }

    deletePoint(pointData, marker) {
        // マーカーを地図から削除
        this.map.removeLayer(marker);
        
        // 配列から削除
        this.pointMarkers = this.pointMarkers.filter(m => m !== marker);
        
        // GPS データから削除
        if (this.gpsData) {
            this.gpsData.removePoint(pointData);
        }
        
        // UI更新
        this.updatePointCountField();
        
        // 選択中のポイントの場合はクリア
        if (this.selectedPoint === pointData) {
            this.clearPointInfo();
        }
        
        // 削除モードを解除
        this.clearSelection();
    }

    updatePointsDraggable(draggable) {
        this.pointMarkers.forEach(marker => {
            if (draggable) {
                marker.dragging.enable();
                marker.getElement().style.cursor = 'move';
            } else {
                marker.dragging.disable();
                marker.getElement().style.cursor = 'pointer';
            }
        });
    }

    updateSelectedPointData() {
        if (!this.selectedPoint) return;

        const pointIdField = document.getElementById('pointIdField');
        const locationField = document.getElementById('locationField');

        if (pointIdField) {
            this.selectedPoint.id = pointIdField.value;
        }
        
        if (locationField) {
            this.selectedPoint.location = locationField.value;
        }

        // GPS データも更新
        if (this.gpsData) {
            this.gpsData.updatePoint(this.selectedPoint);
        }
    }

    updatePointInfo(pointData) {
        const pointIdField = document.getElementById('pointIdField');
        const latDecimalField = document.getElementById('latDecimalField');
        const lngDecimalField = document.getElementById('lngDecimalField');
        const dmsField = document.getElementById('dmsField');
        const elevationField = document.getElementById('elevationField');
        const locationField = document.getElementById('locationField');

        if (pointIdField) pointIdField.value = pointData.id || '';
        if (latDecimalField) latDecimalField.value = pointData.lat ? pointData.lat.toFixed(8) : '';
        if (lngDecimalField) lngDecimalField.value = pointData.lng ? pointData.lng.toFixed(8) : '';
        if (dmsField) dmsField.value = this.convertToDMS(pointData.lat, pointData.lng);
        if (elevationField) elevationField.value = pointData.elevation || '';
        if (locationField) locationField.value = pointData.location || '';
    }

    clearPointInfo() {
        const fields = ['pointIdField', 'latDecimalField', 'lngDecimalField', 'dmsField', 'elevationField', 'locationField'];
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) field.value = '';
        });
        this.selectedPoint = null;
        this.selectedMarker = null;
    }

    updatePointCountField() {
        const pointCountField = document.getElementById('pointCountField');
        if (pointCountField) {
            pointCountField.value = this.pointMarkers.length.toString();
        }
    }

    clearSelection() {
        const allButtons = document.querySelectorAll('.point-action-btn');
        allButtons.forEach(btn => btn.classList.remove('selected'));
        this.selectedAction = null;
        this.updateMapCursor();
    }

    convertToDMS(lat, lng) {
        if (!lat || !lng) return '';
        
        const convertCoord = (coord, isLat) => {
            const abs = Math.abs(coord);
            const degrees = Math.floor(abs);
            const minutes = Math.floor((abs - degrees) * 60);
            const seconds = Math.round(((abs - degrees) * 60 - minutes) * 60 * 100) / 100;
            
            const direction = isLat ? (coord >= 0 ? 'N' : 'S') : (coord >= 0 ? 'E' : 'W');
            return `${degrees}°${minutes}'${seconds.toFixed(2)}"${direction}`;
        };
        
        return `${convertCoord(lat, true)} / ${convertCoord(lng, false)}`;
    }

    // 既存のGPSデータからポイントを読み込む
    loadExistingPoints() {
        if (!this.gpsData || !this.gpsData.data) return;

        this.gpsData.data.forEach(pointData => {
            const marker = this.createPointMarker(pointData);
            this.pointMarkers.push(marker);
        });

        this.updatePointCountField();
    }
}