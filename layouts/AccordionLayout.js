/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * @license MPL 2.0
 * @copyright Famous Industries, Inc. 2014
 */

/* Modified work copyright © 2015 David Valdman */

define(function(require, exports, module) {
    var Transform = require('samsara/core/Transform');
    var Transitionable = require('samsara/core/Transitionable');
    var View = require('samsara/core/view');
    var LayoutNode = require('samsara/core/nodes/LayoutNode');
    var Stream = require('samsara/streams/Stream');

    var CONSTANTS = {
        DIRECTION : {
            X : 0,
            Y : 1
        }
    };

    var AccordionLayout = View.extend({
        defaults : {
            direction : CONSTANTS.DIRECTION.Y,
            initialAngles : [],
            pivotIndex: 0,
            pivotOffset: 0,
            pivotOffsetRatio: 0
        },
        initialize : function(options){
            this.angles = new Transitionable(options.initialAngles);
            this.input = new Stream();
            this.output = new Stream();
            this.output.subscribe(this._eventOutput);

            this.maxLength = 0; // length of all nodes fully extended
            this.offset = 0; // shift accordion so starting point is at (0,0)

            var displacement = 0;
            this.currentAngles = Stream.lift(function(input, angles){
                if (input === undefined) return angles;

                displacement -= input.delta;

                var ratio = ((this.maxLength - displacement) / this.maxLength);

                var currentAngles = [];
                for (var i = 0; i < angles.length; i++){
                    var angle = angles[i];
                    var currentAngle = (ratio * angle) % (2 * Math.PI);
                    currentAngles.push(currentAngle);
                }

                return currentAngles;
            }.bind(this), [this.input, this.angles]);
        },
        setNodes : function(nodes){
            var transforms = this.currentAngles.map(function(angles){
                var transforms = [];

                var direction = this.options.direction;
                var startIndex = this.options.pivotIndex;

                var pivotOffset = (this.options.pivotOffset)
                    ? this.options.pivotOffset
                    : this.options.pivotOffsetRatio * nodes[startIndex].getSize()[direction];

                var startAngle = angles[startIndex];
                var originY = -pivotOffset * Math.cos(startAngle);
                var originZ = -pivotOffset * Math.sin(startAngle);

                var accordionOffset = this.offset;    // shift to ensure starting point is at 0
                var y = originY - accordionOffset;
                var z = originZ;

                // TODO: remove these offsets
                var offsetX = 100;
                var offsetY = 200;

                var angle, transform, l;
                for (i = startIndex - 1; i >= 0; i--) {
                    angle = angles[i];
                    l = nodes[i].getSize()[direction];

                    y -= l * Math.cos(angle);
                    z -= l * Math.sin(angle);

                    transform = (direction === CONSTANTS.DIRECTION.Y)
                        ? Transform.thenMove(
                            Transform.rotateX(angle),
                            [offsetX, y + offsetY, z]
                        )
                        : Transform.thenMove(
                            Transform.rotateY(-angle),
                            [offsetX + y, offsetY, z]
                        );

                    transforms[i] = transform;
                }

                y = originY - accordionOffset;
                z = originZ;

                for (i = startIndex; i < nodes.length; i++){
                    angle = angles[i];
                    l = nodes[i].getSize()[direction];

                    transform = (direction === CONSTANTS.DIRECTION.Y)
                        ? Transform.thenMove(
                            Transform.rotateX(angle),
                            [offsetX, y + offsetY, z]
                        )
                        : Transform.thenMove(
                            Transform.rotateY(-angle),
                            [offsetX + y, offsetY, z]
                        );

                    z += l * Math.sin(angle);
                    y += l * Math.cos(angle);
                    transforms.push(transform);
                }

                return {
                    transforms : transforms,
                    length : y
                };
            }.bind(this));

            this.offset = 0;
            for (var i = 0; i < nodes.length; i++){
                var angle = this.options.initialAngles[i];
                var l = nodes[i].getSize()[this.options.direction];
                var length = l * Math.cos(angle);
                if (i < this.options.pivotIndex)
                    this.offset -= length;

                var transform = transforms.pluck('transforms').pluck(i);

                var layout = new LayoutNode({
                    transform : transform
                });

                this.add(layout).add(nodes[i]);

                this.maxLength += nodes[i].getSize()[this.options.direction];
            }

            this._eventOutput.subscribe(transforms
                .pluck('length')
                .map(function(length){
                    return {
                        value : length,
                        progress : length / this.maxLength
                    };
                }.bind(this))
            );
        },
        setAngles : function(angles, transition, callback){
            this.angles.set(angles, transition, callback)
        }
    });

    module.exports = AccordionLayout;
});
