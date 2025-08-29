// ルートデータ管理と保存機能を専門に扱うモジュール
import { FileHandler } from './file-handler.js';

export class RouteDataManager {
    constructor(imageOverlay, gpsData) {
        this.imageOverlay = imageOverlay;
        this.gpsData = gpsData;
        this.fileHandler = new FileHandler();
        this.loadedRoutes = [];
    }

    // ルートデータからウェイポイント配列を取得する統一メソッド
    getWaypoints(routeData) {
        return routeData.wayPoint || routeData.wayPoints || routeData.points || [];
    }

    // ルートデータからスタート/エンドポイント名を取得する統一メソッド
    getRoutePoints(routeData) {
        return {
            startPoint: routeData.startPoint || routeData.start || routeData.startPointId || (routeData.routeInfo && routeData.routeInfo.startPoint),
            endPoint: routeData.endPoint || routeData.end || routeData.endPointId || (routeData.routeInfo && routeData.routeInfo.endPoint)
        };
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

    // 単一のルートJSONファイルを読み込む
    loadRouteJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const routeData = JSON.parse(e.target.result);
                    
                    // JSONファイル内容の検証
                    const validationResult = this.validateRouteJSON(routeData);
                    if (!validationResult.isValid) {
                        // 警告は呼び出し元で処理
                        routeData._validationWarnings = validationResult.warnings;
                    }
                    
                    // ルートデータを保存（type、indexが設定されていない場合は初期化）
                    this.initializeWaypointData(routeData);
                    this.loadedRoutes.push(routeData);
                    
                    resolve(routeData);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
            reader.readAsText(file);
        });
    }

    // ウェイポイントデータを初期化（type、indexが設定されていない場合）
    initializeWaypointData(routeData) {
        const wayPoints = this.getWaypoints(routeData);
        
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

    // JSONファイル内容の検証
    validateRouteJSON(routeData) {
        const warnings = [];
        let isValid = true;
        
        // 実際のプロパティ名を動的に取得（routeInfo内も確認）
        const { startPoint, endPoint } = this.getRoutePoints(routeData);
        const wayPoint = this.getWaypoints(routeData);
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

    // ルートデータ更新（wayPointCount、編集フラグ）
    updateRouteData(routeData) {
        // wayPointCountを更新
        if (routeData.wayPointCount !== undefined) {
            const wayPoints = this.getWaypoints(routeData);
            routeData.wayPointCount = wayPoints.length;
        }

        console.log('RouteDataManager.updateRouteData: ルートデータ更新完了', routeData);

        // ルートが編集されたことをマーク
        routeData.isEdited = true;
    }

    // ルート内のウェイポイントを更新する統一メソッド
    updateWaypointsInRoute(routeData, newWaypoints) {
        if (routeData.wayPoint) {
            routeData.wayPoint = newWaypoints;
        } else if (routeData.wayPoints) {
            routeData.wayPoints = newWaypoints;
        } else if (routeData.points) {
            routeData.points = newWaypoints;
        }
    }

    // 選択されているルートを保存する機能
    async saveSelectedRoute(selectedRoute) {
        if (!selectedRoute) {
            throw new Error('ルートを選択してください。');
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
                // 編集状態をクリア
                selectedRoute.isEdited = false;
                return { success: true, filename: result.filename || filename };
            } else {
                // キャンセルまたはエラーの場合
                if (result.error === 'キャンセル') {
                    return { success: false, cancelled: true };
                } else {
                    return { success: false, error: result.error || '保存に失敗しました。' };
                }
            }
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 保存用データを準備（仕様に従って中間点のJSON形式で保存）
    prepareSaveData(routeData) {
        const wayPoint = this.getWaypoints(routeData);
        
        if (!wayPoint || !Array.isArray(wayPoint)) {
            throw new Error('保存可能なルートデータがありません。');
        }

        // 保存データの構築（読み込み時と同じ構造、type・index・四捨五入された座標を含む）
        const { startPoint, endPoint } = this.getRoutePoints(routeData);
        const saveData = {
            imageReference: this.imageOverlay.currentImageFileName || '',
            startPoint: startPoint || '',
            endPoint: endPoint || '',
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
        
        const { startPoint, endPoint } = this.getRoutePoints(routeData);
        
        return `${imageFileName}_route_${startPoint || 'start'}_to_${endPoint || 'end'}.json`;
    }

    // 読み込まれたルート一覧を取得
    getLoadedRoutes() {
        return this.loadedRoutes;
    }

    // ルートを削除
    removeRoute(routeData) {
        const routeIndex = this.loadedRoutes.findIndex(route => route === routeData);
        if (routeIndex !== -1) {
            this.loadedRoutes.splice(routeIndex, 1);
        }
    }

    // 全ルートをクリア
    clearAllRoutes() {
        this.loadedRoutes = [];
    }
}