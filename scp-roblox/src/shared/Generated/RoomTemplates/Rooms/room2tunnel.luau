--!nocheck
-- FICHIER GÉNÉRÉ par tools/convert_scpcb.py : ne pas modifier à la main.

return {
	name = "room2tunnel",
	description = "A closed gate, and elevators leading to the maintenance tunnels. Gate can be opened if SCP-372's chamber is in the map for the code.",
	shape = "2",
	commonness = 0,
	large = false,
	disableDecals = true,
	zones = { 2 },
	asset = "room2tunnel",
	boundsMin = { -22, -0.8, -25.6 },
	boundsMax = { 22, 12.8, 25.6 },
	triggerBoxes = {},
	lights = {
		{
			position = { 0, 9.2, -6.4 },
			range = 10,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { 0, 9.2, 8 },
			range = 10,
			color = { 255, 255, 255 },
			brightness = 1.2,
		},
		{
			position = { 14.4739, 11.7239, -16.4 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
		{
			position = { -14.4739, 11.7239, 16.4 },
			range = 15,
			color = { 255, 255, 255 },
			brightness = 1,
		},
	},
	spotlights = {},
	waypoints = {
		{ 0, 0.9, -16.4 },
		{ 14.4, 0.9, -16.4 },
		{ 0, 0.9, 16.4 },
		{ -14.4, 0.9, 16.4 },
	},
	sounds = {},
	screens = {},
	props = {},
	playerStarts = {},
}
