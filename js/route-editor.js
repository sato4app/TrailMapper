// ルート編集機能を管理するモジュール
import { FileHandler } from './file-handler.js';

export class RouteEditor {
    constructor(map, imageOverlay, gpsData) {
        this.map = map;
        this.imageOverlay = imageOverlay;
        this.gpsData = gpsData;
        this.routeData = [];
        this.loadedRoutes = [];
        this.waypointMarkers = [];
        this.routeLines = [];
        this.selectedActionButton = null;
        this.fileHandler = new FileHandler();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        const loadRouteJsonBtn = document.getElementById('loadRouteJsonBtn');
        const routeJsonInput = document.getElementById('routeJsonInput');
        const routeSelect = document.getElementById('routeSelect');

        if (loadRouteJsonBtn && routeJsonInput) {
            loadRouteJsonBtn.addEventListener('click', () => {
                routeJsonInput.click();
            });

            routeJsonInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                    this.loadMultipleRouteJSONs(files).catch(error => {
                        this.showErrorMessage('ルートJSONファイルの読み込みに失敗しました', error.message);
                    });
                }
            });
        }
        
        if (routeSelect) {
            routeSelect.addEventListener('change', () => {
                this.clearActionButtonSelection();
                this.onRouteSelectionChange();
            });
        }

        // ルート操作ボタンのイベントハンドラー
        const addRouteBtn = document.getElementById('addRouteBtn');
        const moveRouteBtn = document.getElementById('moveRouteBtn');
        const deleteRouteBtn = document.getElementById('deleteRouteBtn');
        const clearRouteBtn = document.getElementById('clearRouteBtn');
        const saveRouteBtn = document.getElementById('saveRouteBtn');
        const segmentRouteBtn = document.getElementById('segmentRouteBtn');
        const optimizeRouteBtn = document.getElementById('optimizeRouteBtn');
        const saveGeoJsonRouteBtn = document.getElementById('saveGeoJsonRouteBtn');

        if (addRouteBtn) {
            addRouteBtn.addEventListener('click', () => {
                this.toggleActionButton('add', addRouteBtn);
            });
        }

        if (moveRouteBtn) {
            moveRouteBtn.addEventListener('click', () => {
                this.toggleActionButton('move', moveRouteBtn);
            });
        }

        if (deleteRouteBtn) {
            deleteRouteBtn.addEventListener('click', () => {
                this.toggleActionButton('delete', deleteRouteBtn);
            });
        }

        if (clearRouteBtn) {
            clearRouteBtn.addEventListener('click', () => {
                this.clearActionButtonSelection();
                this.clearSelectedRoute();
            });
        }

        if (saveRouteBtn) {
            saveRouteBtn.addEventListener('click', () => {
                this.clearActionButtonSelection();
                this.saveSelectedRoute();
            });
        }

        if (segmentRouteBtn) {
            segmentRouteBtn.addEventListener('click', () => {
                this.clearActionButtonSelection();
                this.drawRouteSegments();
            });
        }

        if (optimizeRouteBtn) {
            optimizeRouteBtn.addEventListener('click', () => {
                this.clearActionButtonSelection();
                this.optimizeRoute();
            });
        }

        if (saveGeoJsonRouteBtn) {
            saveGeoJsonRouteBtn.addEventListener('click', () => {
                this.clearActionButtonSelection();
                // GeoJSON出力機能（未実装）
            });
        }

        // 地図クリックイベントハンドラー
        this.map.on('click', (e) => {
            this.onMapClick(e);
        });
    }

    // 複数のルートJSONファイルを一度に読み込む
    async loadMultipleRouteJSONs(files) {
        const loadPromises = [];
        
        for (let i = 0; i < files.length; i++) {
            loadPromises.push(this.loadRouteJSON(files[i]));
        }
        
        try {
            const results = await Promise.all(loadPromises);
            return results;
        } catch (error) {
            throw new Error(`複数ファイル読み込み中にエラーが発生しました: ${error.message}`);
        }
    }

    loadRouteJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const routeData = JSON.parse(e.target.result);
                    
                    // JSONファイル内容の検証
                    const validationResult = this.validateRouteJSON(routeData);
                    if (!validationResult.isValid) {
                        this.showWarningMessage('ルートJSONファイル検証警告', validationResult.warnings.join('\n'));
                    }
                    
                    // ルートデータを保存（type、indexが設定されていない場合は初期化）
                    this.initializeWaypointData(routeData);
                    this.loadedRoutes.push(routeData);
                    this.updateRouteSelector();
                    
                    // 全てのルートを表示（新しく読み込んだルートを選択状態で）
                    this.displayAllRoutes(routeData);
                    
                    resolve(routeData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
            reader.readAsText(file);
        });
    }

    // ルート操作ボタンの選択状態をクリアする
    clearActionButtonSelection() {
        const allButtons = document.querySelectorAll('.route-action-btn');
        allButtons.forEach(btn => btn.classList.remove('selected'));
        this.selectedActionButton = null;
        this.updateMapCursor();
    }

    // ルート操作ボタンの選択・未選択状態を切り替える
    toggleActionButton(action, buttonElement) {
        // 全てのボタンから選択状態を削除
        const allButtons = document.querySelectorAll('.route-action-btn');
        allButtons.forEach(btn => btn.classList.remove('selected'));

        // クリックしたボタンが現在選択されているボタンと同じ場合は未選択状態にする
        if (this.selectedActionButton === action) {
            this.selectedActionButton = null;
            this.updateMapCursor();
        } else {
            // 新しいボタンを選択状態にする
            this.selectedActionButton = action;
            buttonElement.classList.add('selected');
            this.updateMapCursor();
        }
    }

    // 地図クリック時の処理
    onMapClick(e) {
        if (!this.selectedActionButton) {
            return;
        }

        const routeSelect = document.getElementById('routeSelect');
        if (!routeSelect || !routeSelect.value) {
            this.showErrorMessage('エラー', 'ルートを選択してください。');
            return;
        }
        
        const selectedRoute = this.getSelectedRoute();
        if (!selectedRoute) {
            return;
        }

        switch (this.selectedActionButton) {
            case 'add':
                this.addWaypointToRoute(e.latlng, selectedRoute);
                break;
            case 'delete':
                this.deleteWaypointFromRoute(e.latlng, selectedRoute);
                break;
        }
    }

    // 地図にウェイポイントを追加
    addWaypointToRoute(latlng, routeData) {
        // GPSポイントとの重複のみチェック（他のルートとの重複は許可）
        if (this.isNearGPSPoint(latlng)) {
            return;
        }

        // 地図座標を画像座標に変換
        const imageCoords = this.convertMapToImageCoordinates(latlng.lat, latlng.lng);
        if (!imageCoords) {
            this.showErrorMessage('エラー', '画像座標への変換に失敗しました。');
            return;
        }

        // 新しいウェイポイントを作成（四捨五入して整数化、type、index追加）
        const wayPoints = routeData.wayPoint || routeData.wayPoints || routeData.points || [];
        const nextIndex = this.getNextWaypointIndex(routeData);
        
        const newWaypoint = {
            type: "waypoint",
            index: nextIndex,
            imageX: Math.round(imageCoords.x),
            imageY: Math.round(imageCoords.y)
        };

        // ルートデータのウェイポイント配列に追加
        if (wayPoints && Array.isArray(wayPoints)) {
            wayPoints.push(newWaypoint);
        } else {
            routeData.wayPoint = [newWaypoint];
        }

        // wayPointCountを更新
        if (routeData.wayPointCount !== undefined) {
            routeData.wayPointCount = (routeData.wayPoint || routeData.wayPoints || routeData.points).length;
        }

        // ルートが編集されたことをマーク
        routeData.isEdited = true;
        
        // ルートセレクターのオプション値を更新
        this.updateRouteOptionValue(routeData);
        
        // 地図を再描画
        this.displayAllRoutes(routeData);
    }

    // 次のウェイポイントindexを取得
    getNextWaypointIndex(routeData) {
        const wayPoints = routeData.wayPoint || routeData.wayPoints || routeData.points || [];
        
        if (wayPoints.length === 0) {
            return 1; // 最初のウェイポイントはindex 1から開始
        }
        
        // 既存のindex値の最大値を取得
        const existingIndexes = wayPoints
            .map(point => point.index)
            .filter(index => typeof index === 'number' && !isNaN(index));
        
        if (existingIndexes.length === 0) {
            return 1; // index が設定されていないウェイポイントがある場合
        }
        
        return Math.max(...existingIndexes) + 1;
    }

    // ウェイポイントデータを初期化（type、indexが設定されていない場合）
    initializeWaypointData(routeData) {
        const wayPoints = routeData.wayPoint || routeData.wayPoints || routeData.points;
        
        if (!wayPoints || !Array.isArray(wayPoints)) {
            return;
        }
        
        wayPoints.forEach((point, arrayIndex) => {
            // type が設定されていない場合は "waypoint" を設定
            if (!point.type) {
                point.type = "waypoint";
            }
            
            // index が設定されていない場合は配列のインデックス + 1 を設定
            if (point.index === undefined || point.index === null) {
                point.index = arrayIndex + 1;
            }
            
            // imageX, imageY を整数化（既存データの場合）
            if (point.imageX !== undefined) {
                point.imageX = Math.round(point.imageX);
            }
            if (point.imageY !== undefined) {
                point.imageY = Math.round(point.imageY);
            }
        });
    }

    // ウェイポイントを削除
    deleteWaypointFromRoute(latlng, routeData) {
        const wayPoints = routeData.wayPoint || routeData.wayPoints || routeData.points;
        if (!wayPoints || !Array.isArray(wayPoints)) {
            return;
        }

        // クリックした位置から最も近いウェイポイントを探す
        let closestIndex = -1;
        let minDistance = Infinity;
        const threshold = 100; // ピクセル単位の閾値を増やす

        wayPoints.forEach((point, index) => {
            const mapPosition = this.convertImageToMapCoordinates(point.imageX, point.imageY);
            if (mapPosition) {
                // 地図座標での距離を計算（メートル単位）
                const mapDistance = latlng.distanceTo(mapPosition);
                
                // ピクセル距離も計算
                const markerPixel = this.map.latLngToContainerPoint(mapPosition);
                const clickPixel = this.map.latLngToContainerPoint(latlng);
                const pixelDistance = markerPixel.distanceTo(clickPixel);
                
                // どちらかの条件を満たせば削除対象とする
                if ((mapDistance < 50 || pixelDistance < threshold) && (mapDistance < minDistance || pixelDistance < minDistance)) {
                    minDistance = Math.min(mapDistance, pixelDistance);
                    closestIndex = index;
                }
            }
        });

        // 最も近いウェイポイントを削除
        if (closestIndex !== -1) {
            wayPoints.splice(closestIndex, 1);
            
            // wayPointCountを更新
            if (routeData.wayPointCount !== undefined) {
                routeData.wayPointCount = wayPoints.length;
            }

            // ルートが編集されたことをマーク
            routeData.isEdited = true;

            // ルートセレクターのオプション値を更新
            this.updateRouteOptionValue(routeData);
            
            // 地図を再描画
            this.displayAllRoutes(routeData);
        } else {
            // 削除対象が見つからなかった場合のメッセージ
            console.log('削除対象のウェイポイントが見つかりませんでした');
        }
    }

    // 指定されたウェイポイントを直接削除
    deleteSpecificWaypoint(targetPoint, routeData) {
        const wayPoints = routeData.wayPoint || routeData.wayPoints || routeData.points;
        if (!wayPoints || !Array.isArray(wayPoints)) {
            return;
        }

        // 対象のウェイポイントを検索
        const targetIndex = wayPoints.findIndex(point => 
            point.imageX === targetPoint.imageX && point.imageY === targetPoint.imageY
        );

        if (targetIndex !== -1) {
            // ウェイポイントを削除
            wayPoints.splice(targetIndex, 1);
            
            // wayPointCountを更新
            if (routeData.wayPointCount !== undefined) {
                routeData.wayPointCount = wayPoints.length;
            }

            // ルートが編集されたことをマーク
            routeData.isEdited = true;

            // ルートセレクターのオプション値を更新
            this.updateRouteOptionValue(routeData);
            
            // 地図を再描画
            this.displayAllRoutes(routeData);
        }
    }

    // GPSポイントに近いかどうかをチェック
    isNearGPSPoint(latlng) {
        if (this.gpsData && this.gpsData.gpsPoints) {
            for (const gpsPoint of this.gpsData.gpsPoints) {
                const distance = latlng.distanceTo([gpsPoint.latitude, gpsPoint.longitude]);
                if (distance < 5) { // 5メートル以内の場合は近すぎるとみなす
                    return true;
                }
            }
        }
        return false;
    }

    // 既存のポイントかどうかをチェック（指定されたルート以外をチェック）
    isExistingPoint(latlng, excludeRoute = null) {
        // GPSポイントとの重複をチェック
        if (this.gpsData && this.gpsData.gpsPoints) {
            for (const gpsPoint of this.gpsData.gpsPoints) {
                const distance = latlng.distanceTo([gpsPoint.latitude, gpsPoint.longitude]);
                if (distance < 10) { // 10メートル以内の場合は既存とみなす
                    return true;
                }
            }
        }

        // 他のルートのウェイポイントとの重複をチェック（除外ルート以外）
        for (const route of this.loadedRoutes) {
            // excludeRouteが指定されている場合はそのルートをスキップ
            if (excludeRoute && route === excludeRoute) {
                continue;
            }
            
            const wayPoints = route.wayPoint || route.wayPoints || route.points;
            if (wayPoints && Array.isArray(wayPoints)) {
                for (const point of wayPoints) {
                    const mapPosition = this.convertImageToMapCoordinates(point.imageX, point.imageY);
                    if (mapPosition) {
                        const distance = latlng.distanceTo(mapPosition);
                        if (distance < 3) { // 3メートル未満の場合は既存とみなす
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    // 地図座標を画像座標に変換
    convertMapToImageCoordinates(lat, lng) {
        if (!this.imageOverlay || !this.imageOverlay.imageOverlay) {
            return null;
        }

        const overlay = this.imageOverlay.imageOverlay;
        const bounds = overlay.getBounds();
        const imageElement = overlay.getElement();

        if (!imageElement) {
            return null;
        }

        // 画像の元のサイズを取得
        const imageNaturalWidth = imageElement.naturalWidth;
        const imageNaturalHeight = imageElement.naturalHeight;

        if (imageNaturalWidth === 0 || imageNaturalHeight === 0) {
            return null;
        }

        // 地図座標から画像内の相対位置を計算
        const relativeX = (lng - bounds.getWest()) / (bounds.getEast() - bounds.getWest());
        const relativeY = (bounds.getNorth() - lat) / (bounds.getNorth() - bounds.getSouth());

        // 画像座標に変換
        const imageX = relativeX * imageNaturalWidth;
        const imageY = relativeY * imageNaturalHeight;

        return { x: imageX, y: imageY };
    }

    // 選択されているルートを取得
    getSelectedRoute() {
        const routeSelect = document.getElementById('routeSelect');
        if (!routeSelect) {
            return null;
        }

        const selectedValue = routeSelect.value;
        
        // より柔軟なマッチング：startPoint ～ endPointの部分で一致を判定
        return this.loadedRoutes.find(route => {
            const startPoint = route.startPoint || route.start || route.startPointId || (route.routeInfo && route.routeInfo.startPoint);
            const endPoint = route.endPoint || route.end || route.endPointId || (route.routeInfo && route.routeInfo.endPoint);
            const routePrefix = `${startPoint} ～ ${endPoint}（`;
            return selectedValue.startsWith(routePrefix);
        });
    }

    // カーソルアイコンを更新
    updateMapCursor() {
        const mapContainer = this.map.getContainer();
        
        switch (this.selectedActionButton) {
            case 'add':
                mapContainer.style.cursor = 'crosshair';
                break;
            case 'move':
                mapContainer.style.cursor = 'move';
                break;
            case 'delete':
                mapContainer.style.cursor = 'pointer';
                break;
            default:
                mapContainer.style.cursor = '';
                break;
        }

        // 既存のマーカーのドラッグ可能状態を更新
        this.updateMarkerDraggableState();
    }

    // マーカーのドラッグ可能状態を更新
    updateMarkerDraggableState() {
        const selectedRoute = this.getSelectedRoute();
        
        this.waypointMarkers.forEach(marker => {
            if (marker.routeData === selectedRoute && this.selectedActionButton === 'move') {
                // ドラッグを有効化
                if (marker.dragging) {
                    marker.dragging.enable();
                }
                
                // ドラッグイベントを追加（重複追加を防ぐため一旦削除）
                marker.off('dragend');
                marker.on('dragend', (e) => {
                    this.onWaypointDragEnd(e, marker.waypointData, marker.routeData);
                });
            } else {
                // ドラッグを無効化
                if (marker.dragging) {
                    marker.dragging.disable();
                }
                marker.off('dragend');
            }
        });
    }

    // ウェイポイントのドラッグ終了時の処理
    onWaypointDragEnd(e, waypointData, routeData) {
        const newPosition = e.target.getLatLng();
        
        // 新しい地図座標を画像座標に変換
        const imageCoords = this.convertMapToImageCoordinates(newPosition.lat, newPosition.lng);
        if (!imageCoords) {
            // 変換に失敗した場合は元の位置に戻す
            const oldPosition = this.convertImageToMapCoordinates(waypointData.imageX, waypointData.imageY);
            if (oldPosition) {
                e.target.setLatLng(oldPosition);
            }
            this.showErrorMessage('エラー', '画像座標への変換に失敗しました。');
            return;
        }

        // ウェイポイントデータを更新（四捨五入して整数化）
        waypointData.imageX = Math.round(imageCoords.x);
        waypointData.imageY = Math.round(imageCoords.y);

        // ルートが編集されたことをマーク
        routeData.isEdited = true;

        // ルートセレクターのオプション値を更新（ウェイポイント数が変わったため）
        this.updateRouteOptionValue(routeData);
    }

    addRouteToMap(routeData, isSelected = false) {
        // マーカーのクリアは呼び出し元で行うため、ここでは行わない
        
        // waypointを画像上の位置でマーカー追加
        const wayPoint = routeData.wayPoint || routeData.wayPoints || routeData.points;
        
        if (wayPoint && Array.isArray(wayPoint)) {
            wayPoint.forEach((point, index) => {
                
                // imageX, imageYプロパティを読み込み
                const imageX = point.imageX;
                const imageY = point.imageY;
                
                
                if (imageX !== undefined && imageY !== undefined) {
                    
                    // 画像座標から地図座標への変換
                    const mapPosition = this.convertImageToMapCoordinates(imageX, imageY);
                    
                    if (mapPosition) {
                        // 選択状態に応じてアイコンサイズを決定
                        const iconClass = isSelected ? 'waypoint-marker-icon' : 'waypoint-marker-icon waypoint-marker-icon-small';
                        const iconSize = isSelected ? [12, 12] : [8, 8];
                        const iconAnchor = isSelected ? [6, 6] : [4, 4];
                        
                        // オレンジ菱形マーカーを作成
                        const diamondIcon = L.divIcon({
                            className: iconClass,
                            html: '<div class="diamond"></div>',
                            iconSize: iconSize,
                            iconAnchor: iconAnchor
                        });
                        
                        const marker = L.marker(mapPosition, {
                            icon: diamondIcon,
                            draggable: true, // 常にdraggableをtrueにして、後で制御する
                            zIndexOffset: isSelected ? 1000 : 500,
                            pane: 'waypointMarkers'
                        }).addTo(this.map);

                        // マーカーにウェイポイントデータを保存
                        marker.waypointData = point;
                        marker.routeData = routeData;
                        
                        // 初期状態では選択されたルート以外はドラッグ無効
                        if (!isSelected || this.selectedActionButton !== 'move') {
                            if (marker.dragging) {
                                marker.dragging.disable();
                            }
                        } else {
                            // ドラッグ終了時の処理を追加
                            marker.on('dragend', (e) => {
                                this.onWaypointDragEnd(e, point, routeData);
                            });
                        }

                        // 削除モード用のクリックイベントを追加
                        marker.on('click', (e) => {
                            if (isSelected && this.selectedActionButton === 'delete') {
                                // マーカーを直接削除
                                this.deleteSpecificWaypoint(point, routeData);
                                // 地図クリックイベントの伝播を停止
                                L.DomEvent.stopPropagation(e);
                            }
                        });
                        
                        this.waypointMarkers.push(marker);
                    } else {
                    }
                } else {
                }
            });
        } else {
        }
    }

    // 画像座標から地図座標への変換
    convertImageToMapCoordinates(imageX, imageY) {
        
        if (!this.imageOverlay || !this.imageOverlay.imageOverlay) {
            return null;
        }
        
        const overlay = this.imageOverlay.imageOverlay;
        const bounds = overlay.getBounds();
        const imageElement = overlay.getElement();
        
        
        if (!imageElement) {
            return null;
        }
        
        // 画像の元のサイズを取得
        const imageNaturalWidth = imageElement.naturalWidth;
        const imageNaturalHeight = imageElement.naturalHeight;
        
        
        if (imageNaturalWidth === 0 || imageNaturalHeight === 0) {
            return null;
        }
        
        // 画像内の相対位置を計算（元画像サイズベース）
        const relativeX = imageX / imageNaturalWidth;
        const relativeY = imageY / imageNaturalHeight;
        
        
        // 地図座標に変換
        const lat = bounds.getNorth() - (bounds.getNorth() - bounds.getSouth()) * relativeY;
        const lng = bounds.getWest() + (bounds.getEast() - bounds.getWest()) * relativeX;
        
        const result = [lat, lng];
        
        return result;
    }
    
    // JSONファイル内容の検証
    validateRouteJSON(routeData) {
        const warnings = [];
        let isValid = true;
        
        // 実際のプロパティ名を動的に取得（routeInfo内も確認）
        const startPoint = routeData.startPoint || routeData.start || routeData.startPointId || (routeData.routeInfo && routeData.routeInfo.startPoint);
        const endPoint = routeData.endPoint || routeData.end || routeData.endPointId || (routeData.routeInfo && routeData.routeInfo.endPoint);
        const wayPoint = routeData.wayPoint || routeData.wayPoints || routeData.points;
        const wayPointCount = routeData.wayPointCount || routeData.waypointCount || (routeData.routeInfo && routeData.routeInfo.waypointCount);
        
        // imageReferenceの値が読み込んでいるpng画像のファイル名と一致するかチェック
        if (routeData.imageReference && this.imageOverlay && this.imageOverlay.currentImageFileName) {
            if (routeData.imageReference !== this.imageOverlay.currentImageFileName) {
                warnings.push(`imageReference "${routeData.imageReference}" が読み込んでいる画像ファイル名 "${this.imageOverlay.currentImageFileName}" と一致しません。`);
                isValid = false;
            }
        }
        
        // wayPointCountの値がwayPointの件数と一致するかチェック
        if (wayPointCount !== undefined && wayPoint && Array.isArray(wayPoint)) {
            if (wayPointCount !== wayPoint.length) {
                warnings.push(`wayPointCount "${wayPointCount}" がwayPointの実際の件数 "${wayPoint.length}" と一致しません。`);
                isValid = false;
            }
        }
        
        // startPointとendPointがGPSポイントに一致するかチェック
        if (this.gpsData && this.gpsData.gpsPoints) {
            const gpsPointIds = this.gpsData.gpsPoints.map(point => point.id);
            
            if (startPoint && !gpsPointIds.includes(startPoint)) {
                warnings.push(`startPoint "${startPoint}" がGPSポイントに見つかりません。`);
                isValid = false;
            }
            
            if (endPoint && !gpsPointIds.includes(endPoint)) {
                warnings.push(`endPoint "${endPoint}" がGPSポイントに見つかりません。`);
                isValid = false;
            }
        }
        
        return { isValid, warnings };
    }
    
    // ルート選択用ドロップダウンリストの更新
    updateRouteSelector() {
        const routeSelect = document.getElementById('routeSelect');
        if (!routeSelect) return;
        
        // 最後に読み込んだルートを選択
        const lastRoute = this.loadedRoutes[this.loadedRoutes.length - 1];
        if (lastRoute) {
            const startPoint = lastRoute.startPoint || lastRoute.start || lastRoute.startPointId || (lastRoute.routeInfo && lastRoute.routeInfo.startPoint);
            const endPoint = lastRoute.endPoint || lastRoute.end || lastRoute.endPointId || (lastRoute.routeInfo && lastRoute.routeInfo.endPoint);
            const wayPoint = lastRoute.wayPoint || lastRoute.wayPoints || lastRoute.points;
            const waypointCount = wayPoint ? wayPoint.length : 0;
            const optionValue = `${startPoint} ～ ${endPoint}（${waypointCount}）`;
            
            // 既存のオプションをチェック
            let optionExists = false;
            for (let option of routeSelect.options) {
                if (option.value === optionValue) {
                    optionExists = true;
                    break;
                }
            }
            
            // 新しいオプションを追加
            if (!optionExists) {
                const option = document.createElement('option');
                option.value = optionValue;
                option.textContent = optionValue;
                routeSelect.appendChild(option);
            }
            
            // 最後に読み込んだルートを選択
            routeSelect.value = optionValue;
            this.updateRouteDetails(lastRoute);
        }
    }

    // 特定のルートのオプション値を更新（選択状態を維持）
    updateRouteOptionValue(routeData) {
        const routeSelect = document.getElementById('routeSelect');
        if (!routeSelect) {
            return;
        }

        const startPoint = routeData.startPoint || routeData.start || routeData.startPointId || (routeData.routeInfo && routeData.routeInfo.startPoint);
        const endPoint = routeData.endPoint || routeData.end || routeData.endPointId || (routeData.routeInfo && routeData.routeInfo.endPoint);
        const wayPoint = routeData.wayPoint || routeData.wayPoints || routeData.points;
        const waypointCount = wayPoint ? wayPoint.length : 0;
        const editedMark = routeData.isEdited ? '*' : '';
        const newOptionValue = `${startPoint} ～ ${endPoint}（${waypointCount}）${editedMark}`;

        // 現在選択されているオプションを見つけて更新
        for (let i = 0; i < routeSelect.options.length; i++) {
            const option = routeSelect.options[i];
            
            // 既存のオプションが同じルートを指している場合（waypointCountや"*"マークが異なる可能性がある）
            const routePrefix = `${startPoint} ～ ${endPoint}（`;
            if (option.value.startsWith(routePrefix) && (option.value.endsWith('）') || option.value.endsWith('）*'))) {
                option.value = newOptionValue;
                option.textContent = newOptionValue;
                routeSelect.value = newOptionValue;
                break;
            }
        }
    }
    
    // ルート詳細情報の更新（削除されたフィールドに対応）
    updateRouteDetails(routeData) {
        // 詳細フィールドは削除されたため、この関数は現在何も行わない
        // 将来的に必要な場合のために関数は残しておく
    }
    
    // ルート選択変更時の処理
    onRouteSelectionChange() {
        const routeSelect = document.getElementById('routeSelect');
        if (!routeSelect) return;
        
        // 既存の経路線をクリア
        this.clearRouteLines();
        
        // getSelectedRouteメソッドを使用して一貫性のある選択方法を使う
        const selectedRoute = this.getSelectedRoute();
        
        if (selectedRoute) {
            this.updateRouteDetails(selectedRoute);
            this.displayAllRoutes(selectedRoute);
            // マーカーのドラッグ可能状態を更新
            this.updateMarkerDraggableState();
        }
    }

    // 全てのルートを表示（選択されたルートは大きいアイコン、その他は小さいアイコン）
    displayAllRoutes(selectedRoute) {
        
        // 既存のマーカーをクリア
        this.waypointMarkers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.waypointMarkers = [];
        
        // 全てのルートを表示
        this.loadedRoutes.forEach((route, index) => {
            const isSelected = route === selectedRoute;
            this.addRouteToMap(route, isSelected);
        });
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
            border: 2px solid #dc3545;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            border-radius: 8px;
            font-family: sans-serif;
            text-align: center;
            max-width: 400px;
        `;
        messageBox.innerHTML = `
            <h3 style="color: #dc3545; margin-top: 0;">${title}</h3>
            <p style="white-space: pre-line; color: #333;">${message}</p>
            <button onclick="this.parentNode.remove()" style="
                padding: 8px 16px;
                margin-top: 10px;
                border: none;
                background-color: #dc3545;
                color: white;
                border-radius: 4px;
                cursor: pointer;
            ">OK</button>
        `;
        document.body.appendChild(messageBox);
    }
    
    showWarningMessage(title, message) {
        const messageBox = document.createElement('div');
        messageBox.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border: 2px solid #ffc107;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            border-radius: 8px;
            font-family: sans-serif;
            text-align: center;
            max-width: 400px;
        `;
        messageBox.innerHTML = `
            <h3 style="color: #ffc107; margin-top: 0;">${title}</h3>
            <p style="white-space: pre-line; color: #333;">${message}</p>
            <button onclick="this.parentNode.remove()" style="
                padding: 8px 16px;
                margin-top: 10px;
                border: none;
                background-color: #ffc107;
                color: white;
                border-radius: 4px;
                cursor: pointer;
            ">OK</button>
        `;
        document.body.appendChild(messageBox);
    }

    // 選択されているルートを保存する機能
    async saveSelectedRoute() {
        const selectedRoute = this.getSelectedRoute();
        if (!selectedRoute) {
            this.showErrorMessage('エラー', 'ルートを選択してください。');
            return;
        }

        try {
            // 保存用データの準備
            const saveData = this.prepareSaveData(selectedRoute);
            
            // ファイル名の生成（仕様に従う）
            const filename = this.generateSaveFilename(selectedRoute);
            
            // ファイル保存の実行
            const result = await this.fileHandler.saveJSONWithUserChoice(saveData, filename);
            
            // 保存結果に応じて処理
            if (result.success) {
                // 保存成功のメッセージ
                this.showSuccessMessage('保存完了', `ルートデータが保存されました。\nファイル名: ${result.filename || filename}`);
                
                // 編集状態をクリア
                selectedRoute.isEdited = false;
                this.updateRouteOptionValue(selectedRoute);
            } else {
                // キャンセルまたはエラーの場合
                if (result.error === 'キャンセル') {
                    // キャンセル時は何もメッセージを表示しない
                    console.log('保存がキャンセルされました');
                } else {
                    // 実際のエラーの場合
                    this.showErrorMessage('保存エラー', result.error || '保存に失敗しました。');
                }
            }
            
        } catch (error) {
            this.showErrorMessage('保存エラー', error.message);
        }
    }

    // 保存用データを準備（仕様に従って中間点のJSON形式で保存）
    prepareSaveData(routeData) {
        const wayPoint = routeData.wayPoint || routeData.wayPoints || routeData.points;
        
        if (!wayPoint || !Array.isArray(wayPoint)) {
            throw new Error('保存可能なルートデータがありません。');
        }

        // 保存データの構築（読み込み時と同じ構造、type・index・四捨五入された座標を含む）
        const saveData = {
            imageReference: this.imageOverlay.currentImageFileName || '',
            startPoint: routeData.startPoint || routeData.start || routeData.startPointId || (routeData.routeInfo && routeData.routeInfo.startPoint) || '',
            endPoint: routeData.endPoint || routeData.end || routeData.endPointId || (routeData.routeInfo && routeData.routeInfo.endPoint) || '',
            wayPointCount: wayPoint.length,
            wayPoint: wayPoint.map((point, arrayIndex) => ({
                type: point.type || "waypoint",
                index: point.index !== undefined ? point.index : arrayIndex + 1,
                imageX: Math.round(point.imageX || 0),
                imageY: Math.round(point.imageY || 0)
            }))
        };

        // routeInfoがある場合は保持
        if (routeData.routeInfo) {
            saveData.routeInfo = { ...routeData.routeInfo };
        }

        return saveData;
    }

    // ファイル名の生成（仕様に従う）
    generateSaveFilename(routeData) {
        let imageFileName = this.imageOverlay.currentImageFileName || 'unknown';
        
        // PNG ファイルタイプを除去（.pngが含まれている場合は削除）
        if (imageFileName.toLowerCase().endsWith('.png')) {
            imageFileName = imageFileName.slice(0, -4);
        }
        
        const startPoint = routeData.startPoint || routeData.start || routeData.startPointId || (routeData.routeInfo && routeData.routeInfo.startPoint) || 'start';
        const endPoint = routeData.endPoint || routeData.end || routeData.endPointId || (routeData.routeInfo && routeData.routeInfo.endPoint) || 'end';
        
        return `${imageFileName}_route_${startPoint}_to_${endPoint}.json`;
    }

    // 保存成功メッセージを表示
    showSuccessMessage(title, message) {
        const messageBox = document.createElement('div');
        messageBox.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border: 2px solid #28a745;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            border-radius: 8px;
            font-family: sans-serif;
            text-align: center;
            max-width: 400px;
        `;
        messageBox.innerHTML = `
            <h3 style="color: #28a745; margin-top: 0;">${title}</h3>
            <p style="white-space: pre-line; color: #333;">${message}</p>
            <button onclick="this.parentNode.remove()" style="
                padding: 8px 16px;
                margin-top: 10px;
                border: none;
                background-color: #28a745;
                color: white;
                border-radius: 4px;
                cursor: pointer;
            ">OK</button>
        `;
        document.body.appendChild(messageBox);
    }

    // 経路線を描画する機能
    drawRouteSegments() {
        const selectedRoute = this.getSelectedRoute();
        if (!selectedRoute) {
            this.showErrorMessage('エラー', 'ルートを選択してください。');
            return;
        }

        try {
            // 既存の経路線をクリア
            this.clearRouteLines();

            // 開始・終了ポイント名を取得
            const startPointName = selectedRoute.startPoint || selectedRoute.start || selectedRoute.startPointId || (selectedRoute.routeInfo && selectedRoute.routeInfo.startPoint);
            const endPointName = selectedRoute.endPoint || selectedRoute.end || selectedRoute.endPointId || (selectedRoute.routeInfo && selectedRoute.routeInfo.endPoint);
            
            // 開始・終了ポイントを取得
            const startPoint = this.getGpsPointByName(startPointName);
            const endPoint = this.getGpsPointByName(endPointName);

            if (!startPoint) {
                this.showErrorMessage('エラー', '開始ポイントが見つかりません。');
                return;
            }

            if (!endPoint) {
                this.showErrorMessage('エラー', '終了ポイントが見つかりません。');
                return;
            }

            // 中間点を取得してindex順でソート
            const wayPoints = selectedRoute.wayPoint || selectedRoute.wayPoints || selectedRoute.points || [];
            const sortedWayPoints = [...wayPoints].sort((a, b) => (a.index || 0) - (b.index || 0));

            // ルートポイントの座標配列を構築
            const routeCoordinates = [];

            // 開始ポイントを追加
            routeCoordinates.push([startPoint.latitude, startPoint.longitude]);

            // 中間点を追加
            for (const waypoint of sortedWayPoints) {
                const mapPosition = this.convertImageToMapCoordinates(waypoint.imageX, waypoint.imageY);
                if (mapPosition) {
                    routeCoordinates.push(mapPosition);
                }
            }

            // 終了ポイントを追加
            routeCoordinates.push([endPoint.latitude, endPoint.longitude]);

            // 線を描画
            if (routeCoordinates.length >= 2) {
                const routeLine = L.polyline(routeCoordinates, {
                    color: '#ff0000',
                    weight: 2,
                    opacity: 0.8,
                    smoothFactor: 1,
                    pane: 'routeLines'
                });

                routeLine.addTo(this.map);
                this.routeLines.push(routeLine);
            }

        } catch (error) {
            this.showErrorMessage('経路線描画エラー', `経路線の描画中にエラーが発生しました: ${error.message}`);
        }
    }

    // GPSポイントを名前で検索
    getGpsPointByName(pointName) {
        if (!this.gpsData || !pointName) {
            return null;
        }

        // GPSDataクラスのgetGPSMarkers()メソッドを使用してGPSポイントを取得
        const gpsMarkers = this.gpsData.getGPSMarkers();
        if (!gpsMarkers || gpsMarkers.length === 0) {
            return null;
        }

        // pointName（ポイントID）で検索
        const foundMarker = gpsMarkers.find(marker => marker.id === pointName);
        if (foundMarker) {
            return {
                id: foundMarker.id,
                latitude: foundMarker.lat,
                longitude: foundMarker.lng,
                data: foundMarker.data
            };
        }

        return null;
    }

    // 経路線をクリア
    clearRouteLines() {
        this.routeLines.forEach(line => {
            if (this.map.hasLayer(line)) {
                this.map.removeLayer(line);
            }
        });
        this.routeLines = [];
    }

    // ルート最適化機能（中間点の順序を最適化して総距離を最小化）
    optimizeRoute() {
        const selectedRoute = this.getSelectedRoute();
        if (!selectedRoute) {
            this.showErrorMessage('エラー', 'ルートを選択してください。');
            return;
        }

        try {
            // 開始・終了ポイントを取得
            const startPointName = selectedRoute.startPoint || selectedRoute.start || selectedRoute.startPointId || (selectedRoute.routeInfo && selectedRoute.routeInfo.startPoint);
            const endPointName = selectedRoute.endPoint || selectedRoute.end || selectedRoute.endPointId || (selectedRoute.routeInfo && selectedRoute.routeInfo.endPoint);
            
            const startPoint = this.getGpsPointByName(startPointName);
            const endPoint = this.getGpsPointByName(endPointName);

            if (!startPoint || !endPoint) {
                this.showErrorMessage('エラー', '開始または終了ポイントが見つかりません。');
                return;
            }

            // 中間点を取得
            const wayPoints = selectedRoute.wayPoint || selectedRoute.wayPoints || selectedRoute.points || [];
            if (wayPoints.length === 0) {
                this.showErrorMessage('情報', '最適化する中間点がありません。');
                return;
            }

            // 中間点を地図座標に変換
            const waypointCoords = [];
            for (const waypoint of wayPoints) {
                const mapPosition = this.convertImageToMapCoordinates(waypoint.imageX, waypoint.imageY);
                if (mapPosition) {
                    waypointCoords.push({
                        ...waypoint,
                        lat: mapPosition[0],
                        lng: mapPosition[1]
                    });
                }
            }

            // 最適化前の距離を計算
            const originalDistance = this.calculateTotalDistance(startPoint, endPoint, waypointCoords);

            // 最適化を実行（貪欲法）
            const optimizedOrder = this.optimizeWaypointOrder(startPoint, endPoint, waypointCoords);

            // 最適化後の距離を計算
            const optimizedDistance = this.calculateTotalDistance(startPoint, endPoint, optimizedOrder);

            // 最適化されたindexでwayPointsを更新
            optimizedOrder.forEach((waypoint, index) => {
                waypoint.index = index + 1;
            });

            // ルートデータを更新
            if (selectedRoute.wayPoint) {
                selectedRoute.wayPoint = optimizedOrder;
            } else if (selectedRoute.wayPoints) {
                selectedRoute.wayPoints = optimizedOrder;
            } else if (selectedRoute.points) {
                selectedRoute.points = optimizedOrder;
            }

            // wayPointCountを更新
            if (selectedRoute.wayPointCount !== undefined) {
                selectedRoute.wayPointCount = optimizedOrder.length;
            }

            // ルートが編集されたことをマーク
            selectedRoute.isEdited = true;

            // ルートセレクターのオプション値を更新
            this.updateRouteOptionValue(selectedRoute);

            // 地図を再描画
            this.displayAllRoutes(selectedRoute);

            // 最適化後に経路線を自動的に引き直す
            this.drawRouteSegments();

        } catch (error) {
            this.showErrorMessage('最適化エラー', `ルートの最適化中にエラーが発生しました: ${error.message}`);
        }
    }

    // 2点間の距離を計算（メートル単位）
    calculateDistance(point1, point2) {
        const lat1 = point1.lat || point1.latitude;
        const lng1 = point1.lng || point1.longitude;
        const lat2 = point2.lat || point2.latitude;
        const lng2 = point2.lng || point2.longitude;

        const R = 6371000; // 地球の半径（メートル）
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    // 経路の総距離を計算
    calculateTotalDistance(startPoint, endPoint, waypoints) {
        if (waypoints.length === 0) {
            return this.calculateDistance(startPoint, endPoint);
        }

        let totalDistance = 0;
        let currentPoint = startPoint;

        // 開始点から各中間点を経由
        for (const waypoint of waypoints) {
            totalDistance += this.calculateDistance(currentPoint, waypoint);
            currentPoint = waypoint;
        }

        // 最後の中間点から終了点まで
        totalDistance += this.calculateDistance(currentPoint, endPoint);

        return totalDistance;
    }

    // 貪欲法による中間点順序最適化
    optimizeWaypointOrder(startPoint, endPoint, waypoints) {
        if (waypoints.length <= 1) {
            return [...waypoints];
        }

        const optimizedOrder = [];
        const remaining = [...waypoints];
        let currentPoint = startPoint;

        // 貪欲法: 現在地点から最も近い点を順次選択
        while (remaining.length > 0) {
            let nearestIndex = 0;
            let nearestDistance = this.calculateDistance(currentPoint, remaining[0]);

            for (let i = 1; i < remaining.length; i++) {
                const distance = this.calculateDistance(currentPoint, remaining[i]);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = i;
                }
            }

            const nearestWaypoint = remaining.splice(nearestIndex, 1)[0];
            optimizedOrder.push(nearestWaypoint);
            currentPoint = nearestWaypoint;
        }

        return optimizedOrder;
    }

    // 選択されているルートをクリア（削除）する機能
    clearSelectedRoute() {
        const selectedRoute = this.getSelectedRoute();
        if (!selectedRoute) {
            return;
        }

        const startPoint = selectedRoute.startPoint || selectedRoute.start || selectedRoute.startPointId || (selectedRoute.routeInfo && selectedRoute.routeInfo.startPoint) || 'unknown';
        const endPoint = selectedRoute.endPoint || selectedRoute.end || selectedRoute.endPointId || (selectedRoute.routeInfo && selectedRoute.routeInfo.endPoint) || 'unknown';
        
        try {
            // 1. loadedRoutesから該当ルートを削除
            const routeIndex = this.loadedRoutes.findIndex(route => route === selectedRoute);
            if (routeIndex !== -1) {
                this.loadedRoutes.splice(routeIndex, 1);
            }

            // 2. ドロップダウンリストから該当オプションを削除
            const routeSelect = document.getElementById('routeSelect');
            if (routeSelect) {
                const routePrefix = `${startPoint} ～ ${endPoint}（`;
                
                // 該当するオプションを検索して削除
                for (let i = routeSelect.options.length - 1; i >= 0; i--) {
                    const option = routeSelect.options[i];
                    if (option.value.startsWith(routePrefix) && (option.value.endsWith('）') || option.value.endsWith('）*'))) {
                        routeSelect.removeChild(option);
                        break;
                    }
                }

                // ドロップダウンを初期状態にリセット
                if (routeSelect.options.length === 1) { // placeholder optionのみ残っている場合
                    routeSelect.selectedIndex = 0;
                } else if (routeSelect.options.length > 1) {
                    // 他のルートがある場合は最初の有効なオプションを選択
                    routeSelect.selectedIndex = 1;
                    this.onRouteSelectionChange();
                    return; // 他のルートが選択されているので、マーカークリアは不要
                }
            }

            // 3. 経路線をクリア
            this.clearRouteLines();

            // 4. アクションボタンの選択状態をクリア
            this.clearActionButtonSelection();

            // 5. 地図からマーカーをクリア（全てのルートを再描画）
            this.displayAllRoutes(null);
            
        } catch (error) {
            this.showErrorMessage('削除エラー', `ルートの削除中にエラーが発生しました: ${error.message}`);
        }
    }
}