/*

 * Copyright (c) 2014 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

define(function (require, exports) {
    "use strict";
    
    var tinycolor = require("tinycolor"),
        _ = require("lodash");
        
    var strings = require("i18n!nls/strings");
        
    /**
     * Return character style's color object.
     * 
     * @param  {AdobeLibraryElement} element
     * @return {?TinyColor}
     */
    var getCharStyleColor = function (element) {
        var charStyle = element.getPrimaryRepresentation().getValue("characterstyle", "data"),
            color;
            
        if (charStyle.color) {
            var colorData = charStyle.color instanceof Array ? charStyle.color[0] : charStyle.color;
            
            color = tinycolor(colorData.value);
        }
        
        return color;
    };
    
    /**
     * Format character style by attribute names.
     * 
     * @param  {AdobeLibraryElement} element
     * @param  {Array.<string>} attrs - accepted attributes: color, fontFamily, fontSize, fontStyle, leading, tracking
     * @param  {String} separator - separator of the result attributes
     * @return {String}
     */
    var formatCharStyle = function (element, attrs, separator) {
        var style = element.getPrimaryRepresentation().getValue("characterstyle", "data"),
            font = style.adbeFont;
        
        var strs = attrs.map(function (attr) {
            switch (attr) {
                case "color":
                    var color = getCharStyleColor(element);
                    return color ? color.toHexString().toUpperCase() : null;
                    
                case "fontFamily":
                    return font ? font.family : null;
                
                case "fontSize":
                    var fontSize = style.fontSize;
                    return fontSize ? Math.ceil(fontSize.value * 10) / 10 + fontSize.type : null;

                case "fontStyle":
                    return font ? font.style : null;
                
                case "leading":
                    var leading;
                    
                    if (style.adbeAutoLeading) {
                        leading = strings.LIBRARIES.LEADING_AUTO;
                    } else if (style.lineHeight && style.lineHeight.value) {
                        leading = (Math.round(style.lineHeight.value * 100) / 100) + style.lineHeight.type;
                    }
                    
                    return leading ? strings.LIBRARIES.LEADING.replace("%s", leading) : null;
                
                case "tracking":
                    var tracking;
                    
                    if (style.adbeTracking) {
                        tracking = style.adbeTracking;
                    } else if (style.letterSpacing) {
                        tracking = style.letterSpacing.value * 1000;
                    }
                    
                    return tracking ? strings.LIBRARIES.TRACKING.replace("%s", tracking) : null;
                
            }
        });
        
        return _.remove(strs, null).join(separator);
    };

    exports.formatCharStyle = formatCharStyle;
    exports.getCharStyleColor = getCharStyleColor;
});
