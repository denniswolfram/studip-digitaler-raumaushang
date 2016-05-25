/*jslint browser: true */
/*global jQuery, Raumaushang, Countdown */
(function ($, Raumaushang, Countdown) {

    // Allow :active style to work
    // @see https://css-tricks.com/snippets/css/remove-gray-highlight-when-tapping-links-in-mobile-safari/
    document.addEventListener('touchstart', function(){}, true);

    // Exit with error when illegal call
    if (Raumaushang === undefined) {
        throw 'Invalid call, object Raumaushang missing';
    }

    // Initialize variables
    $.extend(Raumaushang, {
        DIRECTION_NEXT: '>',
        DIRECTION_PREVIOUS: '<',
        schedule_hash: null,
        course_data: {},
        current: {
            timestamp: $('meta[name="current-timestamp"]').attr('content')
        },
        initial: {
            timestamp: $('meta[name="current-timestamp"]').attr('content')
        },
        durations: {
            reload: 5 * 60 * 1000,
            course: 10 * 1000,
            help: 10 * 1000,
            return_to_current: 10 * 1000,
            overlay_default: 30 * 1000
        }
    });

    //
    function showOverlay(selector, duration) {
        var hide = function (event) {
            if (event && $(event.target).closest('.qrcode').length > 0) {
                return;
            }

            $(selector).off('.overlay', hide).hide();
            Countdown.stop(selector);
            Countdown.start('main', true);

            if (event !== undefined) {
                event.preventDefault();
                event.stopPropagation();
            }
        };

        $('#loading-overlay:visible').hide();
        Countdown.stop('main');

        $(selector).on('click.overlay', hide).show();
        Countdown.add(selector, duration || Raumaushang.durations.overlay_default, hide);
    }

    //
    var templates = {};
    function render(template_id, data) {
        if (!templates.hasOwnProperty(template_id)) {
            templates[template_id] = $(template_id).html();
            Mustache.parse(templates[template_id]);
        }
        return Mustache.render(templates[template_id], data);
    }

    // Initialize countdowns
    Countdown.add('main', Raumaushang.durations.reload, function () {
        Raumaushang.update();
    }, {
        on_tick: function (diff) {
            var element = $('body > progress');
            if (element.length > 0) {
                element.attr('value', 100 - diff * 100 / this.options.duration);
            }
        }
    });

    // Define request function
    var requests = {};
    Raumaushang.request = function (url, data, callback, forced) {
        if (!forced && requests.hasOwnProperty(url)) {
            var cached = requests[url];
            if (cached.timestamp.format('Ymd') === (new Date).format('Ymd')) {
                return callback(cached.hash, cached.data);
            }
        }

        window.setTimeout(function () {
            $('#loading-overlay').show();
        }, 300);

        return $.ajax({
            type: 'GET',
            url: Raumaushang.api.url + url,
            data: data || {},
            dataType: 'json',
            username: Raumaushang.api.auth.username,
            password: Raumaushang.api.auth.password,
        }).then(function (json, status, jqxhr) {
            var schedule_hash = jqxhr.getResponseHeader('X-Schedule-Hash');

            requests[url] = {
                timestamp: new Date(),
                hash: schedule_hash,
                data: json
            };

            if ($.isFunction(callback)) {
                callback(schedule_hash, json);
            }

        }).fail(function (jqxhr, text, error) {
            if (console !== undefined) {
                console.log('ajax failed', text, error, url);
            }
        }).always(function () {
            $('#loading-overlay').hide();
        });
    }

    // Highlights cells
    Raumaushang.highlight = function () {
        var now  = new Date,
            day  = now.format('w'),
            slot = window.parseInt(now.format('H'), 10);
        $('tr[data-slot],td[data-day],th[data-day]').removeClass('current-day current-slot');
        $('[data-day="' + day + '"]:not(.is-holiday)').addClass('current-day');

        $('tr[data-slot="' + slot + '"],td[data-slot~="' + slot + '"]:not(.is-holiday)').addClass('current-slot');

        window.setTimeout(Raumaushang.highlight, 250);
    };

    // Updates the table (internally requests data)
    Raumaushang.update = function (direction, callback) {
        if (arguments.length === 1 && $.isFunction(direction)) {
            callback  = direction;
            direction = null;
        }

        Countdown.stop('main');

        var old_table   = $('.week-schedule[data-resource-id]').first(),
            resource_id = old_table.data().resourceId,
            chunks      = ['/raumaushang/schedule', resource_id],
            forced      = false;;

        if (Raumaushang.current.timestamp) {
            if (direction === Raumaushang.DIRECTION_NEXT) {
                chunks.push(Raumaushang.current.timestamp + 7 * 24 * 60 * 60);
            } else if (direction === Raumaushang.DIRECTION_PREVIOUS) {
                chunks.push(Raumaushang.current.timestamp - 7 * 24 * 60 * 60);
            } else {
                chunks.push(Raumaushang.current.timestamp);
                forced = true;
            }
        }

        Raumaushang.request(chunks.join('/'), {}, function (schedule_hash, json) {
            var structure     = {},
                new_table     = old_table.clone();
            if (schedule_hash !== Raumaushang.schedule_hash) {
                Raumaushang.schedule_hash = schedule_hash;

                $('tbody tr', old_table).each(function () {
                    var slot = $(this).data().slot;
                    structure[slot] = {};
                    $('thead th[data-day]', old_table).each(function () {
                        var day = $(this).data().day;
                        structure[slot][day] = null;
                    })
                });

                $.each(json, function (day, day_data) {
                    var day = parseInt(day, 10),
                        str = (new Date(day_data.timestamp * 1000)).format('d.m.');
                    $('th[data-day="' + day + '"] date', new_table).text(str);

                    if (day === 1) {
                        Raumaushang.current.timestamp = day_data.timestamp;
                    }

                    $.each(day_data.slots, function (slot, data) {
                        slot = parseInt(slot, 10);

                        data.slots = [slot];
                        for (var i = 1; i < data.duration; i += 1) {
                            if (structure[slot + i] !== undefined) {
                                delete structure[slot + i][day];
                                data.slots.push(slot + i);
                            }
                        }

                        structure[slot][day] = data;

                        Raumaushang.course_data[data.id] = data;
                    });
                });

                //
                $('td[data-day]', new_table).remove();
                $.each(structure, function (slot, days) {
                    var row = $('tr[data-slot="' + slot + '"]', new_table);
                    $.each(days, function (day, data) {
                        var cell = $('<td>&nbsp;</td>').attr('data-day', day);
                        if (data !== null) {
                            cell = render('#schedule-cell-template', $.extend({}, data || {}, {
                                day: day,
                                slots: data.slots.join(' '),
                                hasTeachers: data.teachers.length > 0,
                            }));
                        }
                        row.append(cell);
                    });
                });

                //
                delete structure;
                old_table.replaceWith(new_table);
            }
            Countdown.start('main', true);

            if ($.isFunction(callback)) {
                callback();
            }
        }, forced);
    };

    // Handlers
    $(document).ready(function () {
        // Initialize schedule table
        Raumaushang.update(function () {
            Raumaushang.highlight();
        });
    }).on('select', '*', function (event) {
        event.preventDefault();
    }).on('mousemove mousedown mouseup touchmove touchstart touchend', function (event) {
        Countdown.reset();
    }).on('click', '.course-info', function () {
        $('#loading-overlay').show();

        var course_id = $(this).blur().data().courseId,
            data      = Raumaushang.course_data[course_id],
            day       = $(this).data().day,
            slot      = $(this).closest('tr').data().slot,
            rendered = 'error';

        $('#course-overlay').html(render('#course-template', $.extend({}, data, {
            begin: (new Date(data.begin * 1000)).format('d.m.Y H:i'),
            end: (new Date(data.end * 1000)).format('d.m.Y H:i'),
            hasTeachers: data.teachers.length > 0,
            hasModules: data.modules.length > 0
        }))).find('.qrcode').makeQRCode();

        showOverlay('#course-overlay', Raumaushang.durations.course);

        $('#course-overlay article').on('movestart', function (event) {
            if ($('.qrcode.enlarged', this).length === 0) {
                event.preventDefault();
            }
        }).scrollTop(0);

        $.extend(Raumaushang.current, {
            slot: slot,
            day: day
        });

        return false;
    }).on('click', '.qrcode', function (event) {
        $(this).toggleClass('enlarged');

        event.preventDefault();
        event.stopPropagation();
    }).on('click', '#help-overlay-switch', function () {
        showOverlay('#help-overlay', Raumaushang.durations.help);
    });

    // Swipe actions
    $('body').on('swipeleft swiperight', function (event) {
        if ($('#course-overlay,#help-overlay').is(':visible')) {
            return;
        }

        var direction = event.type === 'swiperight'
                      ? Raumaushang.DIRECTION_PREVIOUS
                      : Raumaushang.DIRECTION_NEXT;
        Raumaushang.update(direction);

        Countdown.add('return-to-current', Raumaushang.durations.return_to_current, function () {
            Raumaushang.current.timestamp = Raumaushang.initial.timestamp;
            Raumaushang.schedule_hash = null;
            Raumaushang.update();
        });
    });

    // Clock
    window.setInterval(function () {
        $('#clock').text((new Date).format('H:i:s'));
    }, 100);


    // Make QR Code
    $.fn.extend({
        makeQRCode: function () {
            return this.each(function () {
                var course_id = $(this).data().courseId,
                    template  = $('meta[name="course-url-template"]').attr('content');
                new QRCode(this, {
                    text: template.replace('#{course_id}', course_id),
                    width: 1024,
                    height: 1024,
                    correctLevel: QRCode.CorrectLevel.H
                });
            });
        }
    });


}(jQuery, Raumaushang, Countdown));