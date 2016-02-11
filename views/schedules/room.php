<h1>
    <?= sprintf(_('Geb�ude "%s" - Raum "%s" - Belegung'),
                htmlReady($room->parent->name),
                htmlReady($room->name)) ?>

    <a href="<?= $controller->url_for('schedules/building/' . $room->parent->id) ?>" class="back-link">
        <?= _('Zur�ck zur Raum�bersicht') ?>
    </a>
</h1>

<?= $this->render_partial('schedule.php', compact('schedule')) ?>
