/**
 * バリデーション機能を提供するクラス
 */
export class Validators {
    /**
     * ポイントIDが「X-nn」形式（英大文字1桁-数字2桁）かどうかをチェック
     * @param {string} value - 検証する値
     * @returns {boolean} 有効な形式かどうか
     */
    static isValidPointIdFormat(value) {
        if (!value || value.trim() === '') {
            return true;
        }
        
        const validPattern = /^[A-Z]-\d{2}$/;
        return validPattern.test(value);
    }

    /**
     * ポイントIDを「X-nn」形式に自動修正する
     * @param {string} value - 修正する値
     * @returns {string} 修正された値
     */
    static formatPointId(value) {
        if (!value || typeof value !== 'string') {
            return value;
        }
        
        const original = value.trim();
        if (original === '') {
            return value;
        }
        
        // 1. 全角文字を半角に変換（英文字は大文字化、「仮」も「カ」として処理）
        let converted = this.convertFullWidthToHalfWidthForPointId(original);
        
        // 2. スペースを全角・半角とも削除
        converted = converted.replace(/[\s　]/g, '');
        
        if (converted === '') {
            return original;
        }
        
        // 3. 末尾が1桁の数字の場合、左をゼロで埋める
        const singleDigitPattern = /^(.*)(\d)$/;
        const singleDigitMatch = converted.match(singleDigitPattern);
        
        if (singleDigitMatch) {
            const prefix = singleDigitMatch[1];
            const digit = singleDigitMatch[2];
            
            // 末尾の1桁を2桁にパディング
            const paddedNumber = digit.padStart(2, '0');
            converted = `${prefix}${paddedNumber}`;
        }
        
        // 4. 末尾が2桁以内の数字で、全体が3文字までの場合、数字の前に"-"を付ける
        if (converted.length <= 3) {
            const shortPattern = /^([A-Z]+)(\d{2})$/;
            const shortMatch = converted.match(shortPattern);
            
            if (shortMatch) {
                const letters = shortMatch[1];
                const numbers = shortMatch[2];
                return `${letters}-${numbers}`;
            }
        }
        
        return converted;
    }
    
    /**
     * ポイントID用の全角文字を半角に変換（英文字は大文字化）
     * @param {string} str - 変換する文字列
     * @returns {string} 変換後の文字列
     */
    static convertFullWidthToHalfWidthForPointId(str) {
        return str.replace(/[Ａ-Ｚａ-ｚ０-９－−‐―仮]/g, function(char) {
            if (char >= 'Ａ' && char <= 'Ｚ') {
                return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
            }
            if (char >= 'ａ' && char <= 'ｚ') {
                const halfWidthChar = String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
                return halfWidthChar.toUpperCase();
            }
            if (char >= '０' && char <= '９') {
                return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
            }
            if (char === '－' || char === '−' || char === '‐' || char === '―') {
                return '-';
            }
            return char;
        }).replace(/[a-z]/g, function(char) {
            // 半角小文字も大文字に変換
            return char.toUpperCase();
        });
    }

    /**
     * 全角英文字と全角数字、全角ハイフンを半角に変換する
     * @param {string} str - 変換する文字列
     * @returns {string} 変換後の文字列
     */
    static convertFullWidthToHalfWidth(str) {
        return str.replace(/[Ａ-Ｚａ-ｚ０-９－−‐―]/g, function(char) {
            if (char >= 'Ａ' && char <= 'Ｚ') {
                return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
            }
            if (char >= 'ａ' && char <= 'ｚ') {
                const halfWidthChar = String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
                return halfWidthChar.toUpperCase();
            }
            if (char >= '０' && char <= '９') {
                return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
            }
            if (char === '－' || char === '−' || char === '‐' || char === '―') {
                return '-';
            }
            return char;
        });
    }

    /**
     * ファイルがPNG形式かどうかをチェック
     * @param {File} file - チェックするファイル
     * @returns {boolean} PNG形式かどうか
     */
    static isPngFile(file) {
        return file && file.type.includes('png');
    }

    /**
     * ファイルがJSON形式かどうかをチェック
     * @param {File} file - チェックするファイル
     * @returns {boolean} JSON形式かどうか
     */
    static isJsonFile(file) {
        return file && file.type.includes('json');
    }

    /**
     * JSONデータがポイント形式として有効かどうかをチェック
     * @param {Object} data - チェックするJSONデータ
     * @returns {boolean} 有効なポイントデータかどうか
     */
    static isValidPointData(data) {
        return data && data.points && Array.isArray(data.points);
    }

    /**
     * JSONデータがルート形式として有効かどうかをチェック
     * @param {Object} data - チェックするJSONデータ
     * @returns {boolean} 有効なルートデータかどうか
     */
    static isValidRouteData(data) {
        return data && data.points && Array.isArray(data.points) && data.routeInfo;
    }
}