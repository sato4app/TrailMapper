// ルート編集機能を管理するモジュール
export class RouteEditor {
    constructor(map, imageOverlay, gpsData) {
        this.map = map;
        this.imageOverlay = imageOverlay;
        this.gpsData = gpsData;
        this.routeData = [];
        this.loadedRoutes = [];
        this.waypointMarkers = [];
        this.selectedActionButton = null;
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
                    
                    // ルートデータを保存
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
        console.log('=== onMapClick開始 ===');
        console.log('selectedActionButton:', this.selectedActionButton);
        
        if (!this.selectedActionButton) {
            console.log('selectedActionButtonが設定されていない');
            return;
        }

        const routeSelect = document.getElementById('routeSelect');
        if (!routeSelect || !routeSelect.value) {
            console.log('ルートが選択されていない');
            this.showErrorMessage('エラー', 'ルートを選択してください。');
            return;
        }

        console.log('ルートセレクト値:', routeSelect.value);
        
        const selectedRoute = this.getSelectedRoute();
        if (!selectedRoute) {
            console.log('selectedRouteが取得できない');
            return;
        }

        console.log('処理対象のアクション:', this.selectedActionButton);

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
        console.log('=== addWaypointToRoute 開始 ===');
        console.log('クリック位置:', latlng);
        console.log('選択されたルート:', routeData);
        console.log('現在のウェイポイント数:', routeData.wayPoint ? routeData.wayPoint.length : 0);
        
        // より簡素化：GPSポイントとの重複のみチェック（他のルートとの重複は許可）
        if (this.isNearGPSPoint(latlng)) {
            console.log('GPSポイントに近いため、追加をスキップ');
            return;
        }

        // 地図座標を画像座標に変換
        const imageCoords = this.convertMapToImageCoordinates(latlng.lat, latlng.lng);
        if (!imageCoords) {
            this.showErrorMessage('エラー', '画像座標への変換に失敗しました。');
            return;
        }

        // 新しいウェイポイントを作成
        const newWaypoint = {
            imageX: imageCoords.x,
            imageY: imageCoords.y
        };

        // ルートデータのウェイポイント配列に追加
        const wayPoints = routeData.wayPoint || routeData.wayPoints || routeData.points;
        if (wayPoints && Array.isArray(wayPoints)) {
            wayPoints.push(newWaypoint);
        } else {
            routeData.wayPoint = [newWaypoint];
        }

        // wayPointCountを更新
        if (routeData.wayPointCount !== undefined) {
            routeData.wayPointCount = (routeData.wayPoint || routeData.wayPoints || routeData.points).length;
        }

        // 地図を再描画
        this.displayAllRoutes(routeData);
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
        console.log('=== isExistingPoint開始 ===');
        console.log('チェック位置:', latlng);
        console.log('除外ルート:', excludeRoute);
        console.log('ロード済みルート数:', this.loadedRoutes.length);
        
        // GPSポイントとの重複をチェック
        if (this.gpsData && this.gpsData.gpsPoints) {
            console.log('GPSポイント数:', this.gpsData.gpsPoints.length);
            for (const gpsPoint of this.gpsData.gpsPoints) {
                const distance = latlng.distanceTo([gpsPoint.latitude, gpsPoint.longitude]);
                if (distance < 10) { // 10メートル以内の場合は既存とみなす
                    console.log('GPSポイントとの距離が近すぎる:', distance);
                    return true;
                }
            }
        }

        // 他のルートのウェイポイントとの重複をチェック（除外ルート以外）
        for (let i = 0; i < this.loadedRoutes.length; i++) {
            const route = this.loadedRoutes[i];
            console.log(`ルート${i}をチェック:`, route === excludeRoute ? '（除外ルート）' : '');
            
            // excludeRouteが指定されている場合はそのルートをスキップ
            if (excludeRoute && route === excludeRoute) {
                console.log('除外ルートなのでスキップ');
                continue;
            }
            
            const wayPoints = route.wayPoint || route.wayPoints || route.points;
            if (wayPoints && Array.isArray(wayPoints)) {
                console.log(`ルート${i}のウェイポイント数:`, wayPoints.length);
                for (let j = 0; j < wayPoints.length; j++) {
                    const point = wayPoints[j];
                    const mapPosition = this.convertImageToMapCoordinates(point.imageX, point.imageY);
                    if (mapPosition) {
                        const distance = latlng.distanceTo(mapPosition);
                        console.log(`ウェイポイント${j}との距離:`, distance);
                        // 距離を3メートル未満に変更（より厳密に）
                        if (distance < 3) {
                            console.log('既存のウェイポイントとの距離が近すぎる');
                            return true;
                        }
                    }
                }
            }
        }

        console.log('既存ポイントではない');
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
            console.log('routeSelectが見つかりません');
            return null;
        }

        const selectedValue = routeSelect.value;
        console.log('選択されているオプション値:', selectedValue);
        
        // より柔軟なマッチング：startPoint ～ endPointの部分で一致を判定
        const matchedRoute = this.loadedRoutes.find(route => {
            const startPoint = route.startPoint || route.start || route.startPointId || (route.routeInfo && route.routeInfo.startPoint);
            const endPoint = route.endPoint || route.end || route.endPointId || (route.routeInfo && route.routeInfo.endPoint);
            const routePrefix = `${startPoint} ～ ${endPoint}（`;
            const isMatch = selectedValue.startsWith(routePrefix);
            console.log(`ルート "${startPoint} ～ ${endPoint}"`, '一致:', isMatch);
            return isMatch;
        });
        
        console.log('getSelectedRoute結果:', matchedRoute);
        return matchedRoute;
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

        // ウェイポイントデータを更新
        waypointData.imageX = imageCoords.x;
        waypointData.imageY = imageCoords.y;

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
        if (!routeSelect) return;

        const startPoint = routeData.startPoint || routeData.start || routeData.startPointId || (routeData.routeInfo && routeData.routeInfo.startPoint);
        const endPoint = routeData.endPoint || routeData.end || routeData.endPointId || (routeData.routeInfo && routeData.routeInfo.endPoint);
        const wayPoint = routeData.wayPoint || routeData.wayPoints || routeData.points;
        const waypointCount = wayPoint ? wayPoint.length : 0;
        const newOptionValue = `${startPoint} ～ ${endPoint}（${waypointCount}）`;

        // 現在選択されているオプションを見つけて更新
        for (let option of routeSelect.options) {
            // 既存のオプションが同じルートを指している場合（waypointCountが異なる可能性がある）
            if (option.value.startsWith(`${startPoint} ～ ${endPoint}（`) && option.value.endsWith('）')) {
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
        
        const selectedValue = routeSelect.value;
        const selectedRoute = this.loadedRoutes.find(route => {
            const startPoint = route.startPoint || route.start || route.startPointId || (route.routeInfo && route.routeInfo.startPoint);
            const endPoint = route.endPoint || route.end || route.endPointId || (route.routeInfo && route.routeInfo.endPoint);
            const wayPoint = route.wayPoint || route.wayPoints || route.points;
            const waypointCount = wayPoint ? wayPoint.length : 0;
            return `${startPoint} ～ ${endPoint}（${waypointCount}）` === selectedValue;
        });
        
        if (selectedRoute) {
            this.updateRouteDetails(selectedRoute);
            this.displayAllRoutes(selectedRoute);
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
}