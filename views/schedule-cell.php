<td class="{{#is_holiday}}is-holiday{{/is_holiday}}{{^is_holiday}}course-info{{/is_holiday}}" data-course-id="{{id}}" data-day="{{day}}" data-slot="{{slots}}" rowspan="{{duration}}">
    <div class="schedule-cell">
        <div class="name">{{code}} {{name}}</div>
    {{#hasTeachers}}
        <ul class="teachers">
        {{#teachers}}
            <li>{{nachname}}</li>
        {{/teachers}}
        </ul>
    {{/hasTeachers}}
    </div>
</td>