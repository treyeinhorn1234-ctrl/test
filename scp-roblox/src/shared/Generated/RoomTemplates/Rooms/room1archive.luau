--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room1archive",
	description = "An archive room, where various (random) items spawn on shelves.",
	shape = "1",
	commonness = 80,
	large = false,
	disableDecals = false,
	zones = { 1 },
	asset = "room1archive",
	boundsMin = { -19.2, -0.4, -18.8 },
	boundsMax = { 7.2, 15.006, 25.6 },
	parts = {
		metal = { -6, 4.8, 4, 24.8, 9.6, 43.2 },
		whitewall = { -6, 7.303, 3.4, 26.4, 15.406, 44.4 },
		dirtymetal = { -6, 5.6, 1.85, 24.8, 8, 35.5 },
		misc = { -6, 4.775, 0.4, 26.4, 9.55, 38.4 },
	},
	triggerBoxes = {},
	lights = {
		{
			position = { -6.4, 9.35, 19.2 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { -6.4, 9.35, -6.4 },
			range = 20,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
	},
	spotlights = {},
	waypoints = {},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
