// ルート編集機能のメインコントローラー（リファクタリング版）
import { RouteWaypointManager } from './route-waypoint-manager.js';
import { RouteOptimizer } from './route-optimizer.js';
import { RouteDataManager } from './route-data-manager.js';

export class RouteEditor {
    constructor(map, imageOverlay, gpsData) {
        this.map = map;
        this.imageOverlay = imageOverlay;
        this.gpsData = gpsData;
        this.selectedActionButton = null;
        
        // 専門クラスのインスタンス化
        this.waypointManager = new RouteWaypointManager(map, imageOverlay, gpsData);
        this.optimizer = new RouteOptimizer(map, gpsData);
        this.dataManager = new RouteDataManager(imageOverlay, gpsData);
        
        this.elements = this.getUIElements();
        this.setupEventHandlers();
    }

    // UI要素を取得する共通メソッド
    getUIElements() {
        return {
            loadRouteJsonBtn: document.getElementById('loadRouteJsonBtn'),
            routeJsonInput: document.getElementById('routeJsonInput'),
            routeSelect: document.getElementById('routeSelect'),
            addRouteBtn: document.getElementById('addRouteBtn'),
            moveRouteBtn: document.getElementById('moveRouteBtn'),
            deleteRouteBtn: document.getElementById('deleteRouteBtn'),
            clearRouteBtn: document.getElementById('clearRouteBtn'),
            saveRouteBtn: document.getElementById('saveRouteBtn'),
            segmentRouteBtn: document.getElementById('segmentRouteBtn'),
            optimizeRouteBtn: document.getElementById('optimizeRouteBtn'),
            saveGeoJsonRouteBtn: document.getElementById('saveGeoJsonRouteBtn')
        };
    }

    // ルートデータからウェイポイント配列を取得する統一メソッド
    getWaypoints(routeData) {
        return this.dataManager.getWaypoints(routeData);
    }

    // ルートデータからスタート/エンドポイント名を取得する統一メソッド
    getRoutePoints(routeData) {
        return this.dataManager.getRoutePoints(routeData);
    }

    setupEventHandlers() {
        this.setupFileHandlers();
        this.setupRouteActionButtons();
        this.setupMapEventHandlers();
    }

    // ファイル操作関連のイベントハンドラー設定
    setupFileHandlers() {
        const { loadRouteJsonBtn, routeJsonInput, routeSelect } = this.elements;

        if (loadRouteJsonBtn && routeJsonInput) {
            loadRouteJsonBtn.addEventListener('click', () => {
                routeJsonInput.click();
            });

            routeJsonInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                    this.loadMultipleRouteJSONs(files).catch(error => {
                        this.showMessage('error', 'ルートJSONファイルの読み込みに失敗しました', error.message);
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
    }

    // ルート操作ボタンのイベントハンドラー設定
    setupRouteActionButtons() {
        const buttonActions = [
            { element: this.elements.addRouteBtn, action: 'add' },
            { element: this.elements.moveRouteBtn, action: 'move' },
            { element: this.elements.deleteRouteBtn, action: 'delete' }
        ];

        buttonActions.forEach(({ element, action }) => {
            if (element) {
                element.addEventListener('click', () => {
                    this.toggleActionButton(action, element);
                });
            }
        });

        const directActions = [
            { element: this.elements.clearRouteBtn, handler: () => this.clearSelectedRoute() },
            { element: this.elements.saveRouteBtn, handler: () => this.saveSelectedRoute() },
            { element: this.elements.segmentRouteBtn, handler: () => this.drawRouteSegments() },
            { element: this.elements.optimizeRouteBtn, handler: () => this.optimizeRoute() },
            { element: this.elements.saveGeoJsonRouteBtn, handler: () => {} } // GeoJSON出力機能（未実装）
        ];

        directActions.forEach(({ element, handler }) => {
            if (element) {
                element.addEventListener('click', () => {
                    this.clearActionButtonSelection();
                    handler();
                });
            }
        });
    }

    // 地図イベントハンドラー設定
    setupMapEventHandlers() {
        this.map.on('click', (e) => {
            this.onMapClick(e);
        });
    }

    // 複数のルートJSONファイルを一度に読み込む
    async loadMultipleRouteJSONs(files) {
        try {
            const results = await this.dataManager.loadMultipleRouteJSONs(files);
            
            // 警告がある場合は表示
            results.forEach(routeData => {
                if (routeData._validationWarnings && routeData._validationWarnings.length > 0) {
                    this.showMessage('warning', 'ルートJSONファイル検証警告', routeData._validationWarnings.join('\n'));
                }
            });

            // ドロップダウンリストを更新（全ルートを追加）
            this.updateRouteSelector();
            
            // ドロップダウンで実際に選択されているルートを取得して表示
            const selectedRoute = this.getSelectedRoute();
            this.displayAllRoutes(selectedRoute);
            
            return results;
        } catch (error) {
            throw error;
        }
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

        if (!this.elements.routeSelect || !this.elements.routeSelect.value) {
            this.showMessage('error', 'エラー', 'ルートを選択してください。');
            return;
        }
        
        const selectedRoute = this.getSelectedRoute();
        if (!selectedRoute) {
            return;
        }

        try {
            switch (this.selectedActionButton) {
                case 'add':
                    this.waypointManager.addWaypointToRoute(e.latlng, selectedRoute, (routeData) => {
                        this.updateRouteDataAndDisplay(routeData);
                    });
                    break;
                case 'delete':
                    this.waypointManager.deleteWaypointFromRoute(e.latlng, selectedRoute, (routeData) => {
                        this.updateRouteDataAndDisplay(routeData);
                    });
                    break;
            }
        } catch (error) {
            this.showMessage('error', 'エラー', error.message);
        }
    }

    // ルートデータ更新と表示更新の統一処理
    updateRouteDataAndDisplay(routeData) {
        this.dataManager.updateRouteData(routeData);
        this.updateRouteOptionValue(routeData);
        this.displayAllRoutes(routeData);
        
        // 中継点変更後に自動的に経路線を描画と最適化を実行
        this.optimizeAndDrawRouteAutomatic(routeData);
    }

    // ドラッグ中の経路線描画（最適化なし、一時的な表示更新）
    updateRouteVisualizationDuringDrag(routeData, tempWaypointData) {
        try {
            // 一時的なルートデータを作成（元のデータは変更しない）
            const tempRouteData = JSON.parse(JSON.stringify(routeData));
            const waypoints = this.getWaypoints(tempRouteData);
            
            // indexまたはtypeで該当するウェイポイントを特定
            const waypointIndex = waypoints.findIndex(wp => 
                (wp.index !== undefined && tempWaypointData.index !== undefined && wp.index === tempWaypointData.index) ||
                (wp.type === tempWaypointData.type && wp.imageX === tempWaypointData.imageX && wp.imageY === tempWaypointData.imageY)
            );
            
            if (waypointIndex !== -1) {
                waypoints[waypointIndex] = { ...tempWaypointData };
                
                // 経路線のみ再描画（最適化は行わない）
                this.drawRouteSegmentsAutomatic(tempRouteData);
            }
        } catch (error) {
            console.warn('ドラッグ中経路線描画エラー:', error.message);
        }
    }

    // ドラッグ終了時専用のデータ更新処理（最適化付き）
    updateRouteDataWithOptimization(routeData) {
        this.dataManager.updateRouteData(routeData);
        this.updateRouteOptionValue(routeData);
        
        // ドラッグ終了時は経路線描画のみ（最適化は手動実行時のみ）
        this.drawRouteSegmentsAutomatic(routeData);
    }

    // 選択されているルートを取得
    getSelectedRoute() {
        if (!this.elements.routeSelect) {
            return null;
        }

        const selectedValue = this.elements.routeSelect.value;
        
        return this.dataManager.getLoadedRoutes().find(route => {
            const { startPoint, endPoint } = this.getRoutePoints(route);
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
        this.waypointManager.updateMarkerDraggableState(
            selectedRoute, 
            this.selectedActionButton,
            // ドラッグ中のコールバック（経路線描画のみ）
            (routeData, tempWaypointData) => {
                this.updateRouteVisualizationDuringDrag(routeData, tempWaypointData);
            },
            // ドラッグ終了時のコールバック（データ更新＋最適化）
            (routeData) => {
                this.updateRouteDataWithOptimization(routeData);
            }
        );
    }

    // 全てのルートを表示（選択されたルートは大きいアイコン、その他は小さいアイコン）
    displayAllRoutes(selectedRoute) {
        // 既存のマーカーをクリア
        this.waypointManager.clearWaypointMarkers();
        
        // 全てのルートを表示
        this.dataManager.getLoadedRoutes().forEach((route, index) => {
            const isSelected = route === selectedRoute;
            this.waypointManager.addRouteToMap(
                route, 
                isSelected,
                (e, waypointData, routeData) => {
                    try {
                        this.waypointManager.onWaypointDragEnd(e, waypointData, routeData, (routeData) => {
                            this.updateRouteDataAndDisplay(routeData);
                        });
                    } catch (error) {
                        this.showMessage('error', 'エラー', error.message);
                    }
                },
                (targetPoint, routeData) => {
                    if (this.selectedActionButton === 'delete') {
                        this.waypointManager.deleteSpecificWaypoint(targetPoint, routeData, (routeData) => {
                            this.updateRouteDataAndDisplay(routeData);
                        });
                    }
                }
            );
        });
    }

    // 統一されたメッセージ表示機能
    showMessage(type, title, message) {
        const messageBox = document.createElement('div');
        messageBox.className = `message-box ${type || 'error'}`;
        
        messageBox.innerHTML = `
            <h3 class="${type || 'error'}">${title}</h3>
            <p>${message}</p>
            <button class="${type || 'error'}" onclick="this.parentNode.remove()">OK</button>
        `;
        document.body.appendChild(messageBox);
    }

    // 後方互換性のためのラッパーメソッド
    showErrorMessage(title, message) {
        this.showMessage('error', title, message);
    }
    
    showWarningMessage(title, message) {
        this.showMessage('warning', title, message);
    }
    
    showSuccessMessage(title, message) {
        this.showMessage('success', title, message);
    }

    // 選択されているルートを保存する機能
    async saveSelectedRoute() {
        const selectedRoute = this.getSelectedRoute();
        if (!selectedRoute) {
            this.showMessage('error', 'エラー', 'ルートを選択してください。');
            return;
        }

        try {
            const result = await this.dataManager.saveSelectedRoute(selectedRoute);
            
            if (result.success) {
                this.showSuccessMessage('保存完了', `ルートデータが保存されました。\nファイル名: ${result.filename}`);
                this.updateRouteOptionValue(selectedRoute);
            } else if (result.cancelled) {
                // キャンセル時は何もメッセージを表示しない
                console.log('保存がキャンセルされました');
            } else {
                this.showMessage('error', '保存エラー', result.error);
            }
            
        } catch (error) {
            this.showMessage('error', '保存エラー', error.message);
        }
    }

    // 経路線を描画する機能
    drawRouteSegments() {
        const selectedRoute = this.getSelectedRoute();
        if (!selectedRoute) {
            this.showMessage('error', 'エラー', 'ルートを選択してください。');
            return;
        }

        try {
            this.optimizer.drawRouteSegments(selectedRoute, (imageX, imageY) => {
                return this.waypointManager.convertImageToMapCoordinates(imageX, imageY);
            });
        } catch (error) {
            this.showMessage('error', '経路線描画エラー', error.message);
        }
    }

    // 中継点変更時の自動経路線描画（エラー時は静かに処理）
    drawRouteSegmentsAutomatic(routeData) {
        if (!routeData) return;

        try {
            this.optimizer.drawRouteSegments(routeData, (imageX, imageY) => {
                return this.waypointManager.convertImageToMapCoordinates(imageX, imageY);
            });
        } catch (error) {
            // 自動描画ではエラーメッセージを表示せず、コンソールログのみ
            console.warn('自動経路線描画エラー:', error.message);
        }
    }

    // 中継点変更時の自動最適化＋経路線描画（エラー時は静かに処理）
    optimizeAndDrawRouteAutomatic(routeData) {
        if (!routeData) return;

        try {
            // まず最適化を実行（中間点が2つ以上ある場合のみ）
            const waypoints = this.getWaypoints(routeData);
            if (waypoints && waypoints.length >= 2) {
                const optimizedOrder = this.optimizer.optimizeRoute(routeData, (imageX, imageY) => {
                    return this.waypointManager.convertImageToMapCoordinates(imageX, imageY);
                });
                
                // ルートデータを更新（最適化されたウェイポイント順序を適用）
                this.dataManager.updateWaypointsInRoute(routeData, optimizedOrder);
            }
            
            // 経路線を描画
            this.optimizer.drawRouteSegments(routeData, (imageX, imageY) => {
                return this.waypointManager.convertImageToMapCoordinates(imageX, imageY);
            });
            
        } catch (error) {
            // 自動処理ではエラーメッセージを表示せず、コンソールログのみ
            console.warn('自動最適化・経路線描画エラー:', error.message);
            
            // 最適化が失敗した場合でも経路線だけは描画を試行
            try {
                this.optimizer.drawRouteSegments(routeData, (imageX, imageY) => {
                    return this.waypointManager.convertImageToMapCoordinates(imageX, imageY);
                });
            } catch (drawError) {
                console.warn('自動経路線描画エラー:', drawError.message);
            }
        }
    }

    // ルート最適化機能（中間点の順序を最適化して総距離を最小化）
    optimizeRoute() {
        const selectedRoute = this.getSelectedRoute();
        if (!selectedRoute) {
            this.showMessage('error', 'エラー', 'ルートを選択してください。');
            return;
        }

        try {
            const optimizedOrder = this.optimizer.optimizeRoute(selectedRoute, (imageX, imageY) => {
                return this.waypointManager.convertImageToMapCoordinates(imageX, imageY);
            });

            // ルートデータを更新
            this.dataManager.updateWaypointsInRoute(selectedRoute, optimizedOrder);
            this.updateRouteDataAndDisplay(selectedRoute);

            // 最適化後に経路線を自動的に引き直す
            this.drawRouteSegments();

        } catch (error) {
            if (error.message.includes('最適化する中間点がありません')) {
                this.showMessage('warning', '情報', error.message);
            } else {
                this.showMessage('error', '最適化エラー', error.message);
            }
        }
    }

    // ルート選択用ドロップダウンリストの更新
    updateRouteSelector() {
        if (!this.elements.routeSelect) return;
        
        const loadedRoutes = this.dataManager.getLoadedRoutes();
        
        // 全てのルートをドロップダウンに追加または更新
        loadedRoutes.forEach(route => {
            const optionValue = this.createRouteOptionValue(route);
            const existingOption = this.findRouteOptionByRoute(route);
            
            if (existingOption) {
                // 既存のオプションを更新（ウェイポイント数が変わっている可能性）
                existingOption.value = optionValue;
                existingOption.textContent = optionValue;
            } else {
                // 新しいオプションを追加
                this.addRouteOption(optionValue);
            }
        });
        
        // 最後に読み込んだルートを選択
        const lastRoute = loadedRoutes[loadedRoutes.length - 1];
        if (lastRoute) {
            const optionValue = this.createRouteOptionValue(lastRoute);
            this.elements.routeSelect.value = optionValue;
            this.updateRouteDetails(lastRoute);
        }
    }

    // ルートオプション値を作成
    createRouteOptionValue(routeData, includeEditedMark = false) {
        const { startPoint, endPoint } = this.getRoutePoints(routeData);
        const wayPoints = this.getWaypoints(routeData);
        const waypointCount = wayPoints ? wayPoints.length : 0;
        const editedMark = includeEditedMark && routeData.isEdited ? '*' : '';
        return `${startPoint} ～ ${endPoint}（${waypointCount}）${editedMark}`;
    }

    // ルートオプションを検索
    findRouteOption(optionValue) {
        for (let option of this.elements.routeSelect.options) {
            if (option.value === optionValue) {
                return option;
            }
        }
        return null;
    }

    // ルートベースでオプションを検索（同じstartPoint-endPointの組み合わせ）
    findRouteOptionByRoute(routeData) {
        const { startPoint, endPoint } = this.getRoutePoints(routeData);
        const routePrefix = `${startPoint} ～ ${endPoint}（`;
        
        for (let option of this.elements.routeSelect.options) {
            if (option.value.startsWith(routePrefix) && (option.value.endsWith('）') || option.value.endsWith('）*'))) {
                return option;
            }
        }
        return null;
    }

    // ルートオプションを追加
    addRouteOption(optionValue) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        this.elements.routeSelect.appendChild(option);
    }

    // 特定のルートのオプション値を更新（選択状態を維持）
    updateRouteOptionValue(routeData) {
        if (!this.elements.routeSelect) {
            return;
        }

        const newOptionValue = this.createRouteOptionValue(routeData, true);
        const { startPoint, endPoint } = this.getRoutePoints(routeData);
        const routePrefix = `${startPoint} ～ ${endPoint}（`;

        // 現在選択されているオプションを見つけて更新
        for (let i = 0; i < this.elements.routeSelect.options.length; i++) {
            const option = this.elements.routeSelect.options[i];
            
            if (option.value.startsWith(routePrefix) && (option.value.endsWith('）') || option.value.endsWith('）*'))) {
                option.value = newOptionValue;
                option.textContent = newOptionValue;
                this.elements.routeSelect.value = newOptionValue;
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
        if (!this.elements.routeSelect) return;
        
        // 既存の経路線をクリア
        this.optimizer.clearRouteLines();
        
        // getSelectedRouteメソッドを使用して一貫性のある選択方法を使う
        const selectedRoute = this.getSelectedRoute();
        
        if (selectedRoute) {
            this.updateRouteDetails(selectedRoute);
            this.displayAllRoutes(selectedRoute);
            // マーカーのドラッグ可能状態を更新
            this.updateMarkerDraggableState();
        }
    }

    // 選択されているルートをクリア（削除）する機能
    clearSelectedRoute() {
        const selectedRoute = this.getSelectedRoute();
        if (!selectedRoute) {
            return;
        }

        const { startPoint, endPoint } = this.getRoutePoints(selectedRoute);
        
        try {
            // 1. loadedRoutesから該当ルートを削除
            this.dataManager.removeRoute(selectedRoute);

            // 2. ドロップダウンリストから該当オプションを削除
            if (this.elements.routeSelect) {
                const routePrefix = `${startPoint || 'unknown'} ～ ${endPoint || 'unknown'}（`;
                
                // 該当するオプションを検索して削除
                for (let i = this.elements.routeSelect.options.length - 1; i >= 0; i--) {
                    const option = this.elements.routeSelect.options[i];
                    if (option.value.startsWith(routePrefix) && (option.value.endsWith('）') || option.value.endsWith('）*'))) {
                        this.elements.routeSelect.removeChild(option);
                        break;
                    }
                }

                // ドロップダウンを初期状態にリセット
                if (this.elements.routeSelect.options.length === 1) { // placeholder optionのみ残っている場合
                    this.elements.routeSelect.selectedIndex = 0;
                } else if (this.elements.routeSelect.options.length > 1) {
                    // 他のルートがある場合は最初の有効なオプションを選択
                    this.elements.routeSelect.selectedIndex = 1;
                    this.onRouteSelectionChange();
                    return; // 他のルートが選択されているので、マーカークリアは不要
                }
            }

            // 3. 経路線をクリア
            this.optimizer.clearRouteLines();

            // 4. アクションボタンの選択状態をクリア
            this.clearActionButtonSelection();

            // 5. 地図からマーカーをクリア（全てのルートを再描画）
            this.displayAllRoutes(null);
            
        } catch (error) {
            this.showMessage('error', '削除エラー', `ルートの削除中にエラーが発生しました: ${error.message}`);
        }
    }
}