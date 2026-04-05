import pytest
from apps.progress.services import sm2_update


class TestSM2Update:
    """Unit tests for the pure SM-2 algorithm."""

    def test_perfect_first_review(self):
        reps, ef, interval = sm2_update(
            quality=5, repetitions=0, ease_factor=2.5, interval_days=0,
        )
        assert reps == 1
        assert interval == 1
        assert ef == pytest.approx(2.6, abs=0.01)

    def test_perfect_second_review(self):
        reps, ef, interval = sm2_update(
            quality=5, repetitions=1, ease_factor=2.6, interval_days=1,
        )
        assert reps == 2
        assert interval == 6
        assert ef >= 2.6

    def test_perfect_third_review(self):
        reps, ef, interval = sm2_update(
            quality=5, repetitions=2, ease_factor=2.6, interval_days=6,
        )
        assert reps == 3
        assert interval == round(6 * ef)

    def test_failed_review_resets(self):
        reps, ef, interval = sm2_update(
            quality=1, repetitions=5, ease_factor=2.5, interval_days=30,
        )
        assert reps == 0
        assert interval == 1

    def test_quality_3_passes(self):
        reps, ef, interval = sm2_update(
            quality=3, repetitions=0, ease_factor=2.5, interval_days=0,
        )
        assert reps == 1
        assert interval == 1

    def test_ease_factor_never_below_1_3(self):
        reps, ef, interval = sm2_update(
            quality=0, repetitions=3, ease_factor=1.3, interval_days=10,
        )
        assert ef >= 1.3

    def test_invalid_quality_raises(self):
        with pytest.raises(ValueError):
            sm2_update(quality=6, repetitions=0, ease_factor=2.5, interval_days=0)

        with pytest.raises(ValueError):
            sm2_update(quality=-1, repetitions=0, ease_factor=2.5, interval_days=0)

    def test_interval_increases_with_repetitions(self):
        """Multiple perfect reviews should yield increasing intervals."""
        reps, ef, interval = 0, 2.5, 0
        intervals = []
        for _ in range(5):
            reps, ef, interval = sm2_update(
                quality=5, repetitions=reps, ease_factor=ef, interval_days=interval,
            )
            intervals.append(interval)
        # Intervals: 1, 6, ~16, ~42, ~110 — strictly increasing
        assert intervals == sorted(intervals)
        assert intervals[-1] > 30  # should be well over a month after 5 perfect reviews
